import { useState, useEffect, ReactNode } from "react";
import Slider from "rc-slider";
import { Address, WalletClient } from "viem";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useWalletClient,
  usePrepareContractWrite,
  useContractWrite,
  useFeeData,
  useWaitForTransaction,
} from "wagmi";
import { fetchBalance } from "@wagmi/core";
import StreamManager, { Stream } from "@apeworx/apepay";

const SECS_PER_DAY = 24 * 60 * 60;

export interface CreateStreamProps {
  streamManagerAddress: Address;
  // TODO: Support dynamically fetching list of accepted tokens in sdk::StreamManager
  tokenAddress: Address;
  amountPerSecond: number;
  reasonCode: string;
  cart?: ReactNode;
  registerStream: (stream: Stream) => void;
}

const CreateStream = (props: CreateStreamProps) => {
  const [nativeBalance, setNativeBalance] = useState<number | null>(null);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [gasPrice, setGasPrice] = useState<number | null>(null);
  const { data: feeData } = useFeeData();
  const { address } = useAccount();

  // Get balances for native tokens (or set to 1 after 5 seconds and keep fetching)
  useEffect(() => {
    let balanceCountdown: NodeJS.Timeout;
    let balanceCountdownTriggered = false;

    if (address) {
      balanceCountdown = setTimeout(() => {
        setNativeBalance(1);
        balanceCountdownTriggered = true;
      }, 5000);

      (async () => {
        const nativeBalanceData = await fetchBalance({ address });
        if (nativeBalanceData && nativeBalanceData.formatted !== undefined) {
          if (!balanceCountdownTriggered) {
            clearTimeout(balanceCountdown);
          }
          setNativeBalance(Number(nativeBalanceData.formatted));
        }
      })();
    }

    return () => {
      clearTimeout(balanceCountdown);
    };
  }, [address]);

  // Get balances for stream tokens (or set to transactionamount+1 after 5 seconds and keep fetching)
  useEffect(() => {
    let tokenCountdown: NodeJS.Timeout;
    let tokenCountdownTriggered = false;

    if (address) {
      tokenCountdown = setTimeout(() => {
        setTokenBalance(1);
        tokenCountdownTriggered = true;
      }, 5000);

      (async () => {
        const tokenBalanceData = await fetchBalance({
          address,
          token: props.tokenAddress,
        });
        if (tokenBalanceData && tokenBalanceData.formatted !== undefined) {
          if (!tokenCountdownTriggered) {
            clearTimeout(tokenCountdown);
          }
          setTokenBalance(Number(tokenBalanceData.formatted));
        }
      })();
    }

    return () => {
      clearTimeout(tokenCountdown);
    };
  }, [address]);

  // Get gas price (or set to 0 after 5 seconds and keep fetching)
  useEffect(() => {
    let gasCountdown: NodeJS.Timeout;
    let gasCountdownTriggered = false;

    gasCountdown = setTimeout(() => {
      setGasPrice(1);
      gasCountdownTriggered = true;
    }, 5000);

    if (
      feeData &&
      feeData.formatted &&
      feeData.formatted.gasPrice !== undefined
    ) {
      if (!gasCountdownTriggered) {
        clearTimeout(gasCountdown);
      }
      setGasPrice(Number(feeData.formatted.gasPrice));
    }

    return () => {
      clearTimeout(gasCountdown);
    };
  }, [feeData]);

  const { data: tokenData } = useBalance({
    address,
    token: props.tokenAddress,
  });

  // TODO: handle `isError`, `isLoading`
  const maxTime = Number(
    (tokenData?.value || BigInt(0)) / BigInt(props.amountPerSecond)
  );

  // TODO: Increase stability of deployments beyond a week
  const maxTimeDays: number = Math.min(Math.floor(maxTime / SECS_PER_DAY), 7); // Up to a week
  const marks = Object.fromEntries(
    Array.from(Array(maxTimeDays).keys()).map((v: number) => [
      v + 1,
      `${v + 1}`,
    ])
  );
  const [selectedTime, setSelectedTime] = useState(SECS_PER_DAY); // Defaults 1 day

  console.log(gasPrice / 10000 + "nat " + nativeBalance + "tok" + tokenBalance);

  const sm = new StreamManager(
    props.streamManagerAddress,
    // TODO: handle `isError`, `isLoading`
    usePublicClient(),
    useWalletClient()?.data as WalletClient
  );

  const { config: approvalConfig } = usePrepareContractWrite({
    address: props.tokenAddress,
    value: BigInt(0),
    abi: [
      {
        name: "approve",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
          { name: "spender", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "success", type: "bool" }],
      },
    ],
    functionName: "approve",
    args: [sm.address, selectedTime * props.amountPerSecond],
  });

  const {
    data,
    isLoading,
    // isSuccess: Make sure transaction has been approved by user (used to get tx hash)
    isSuccess,
    isError,
    write: approveStream,
  } = useContractWrite(approvalConfig);

  // Then make sure transaction has been processed once it has been approved by user
  const [txHash, setTxHash] = useState(null);
  useEffect(() => {
    if (isSuccess && data?.hash) {
      setTxHash(data?.hash);
    }
  }, [isSuccess, data?.hash]);

  const {
    error: txError,
    isSuccess: txSuccess,
    isLoading: txLoading,
  } = useWaitForTransaction({
    hash: txHash,
  });

  // random string for the demo;
  const renderReasonCode = () => {
    return Math.random().toString(36).substring(7);
  };

  const createStream = async () => {
    // Trigger function to get reason string (to be updated with props.renderReasonCode)
    const reasonString = renderReasonCode();
    // Send and wait for stream open to complete
    const stream = await sm.create(
      props.tokenAddress,
      props.amountPerSecond,
      reasonString
    );
    // then update props.registerStream
    props.registerStream(stream);
  };

  // Set transaction amount
  const transactionAmount = Number(
    (
      (selectedTime * props.amountPerSecond) /
      Math.pow(10, tokenData?.decimals || 0)
    ).toFixed(Math.min(tokenData?.decimals || 0, 3))
  );

  // Set card steps logic
  // Set default selected token to USDC
  const [selectedToken, setSelectedToken] = useState(
    "0x7F5c764cBc14f9669B88837ca1490cCa17c31607"
  );

  type Token = {
    address: string;
    symbol: string;
  };
  const [tokens, setTokens] = useState<Token[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  // Fetch tokens from JSON
  useEffect(() => {
    const fetchTokens = async () => {
      const response = await fetch("./TokenList.json");
      const data = await response.json();
      setTokens(data.tokens);
    };

    fetchTokens();
  }, []);

  const validateStep1 = () => {
    if (selectedToken) {
      setCurrentStep(currentStep + 1);
    } else {
      alert("Please select a valid payment token.");
    }
  };
  const validateStep2 = () => {
    setCurrentStep(currentStep + 1);
  };

  const Step1 = () => {
    return (
      <div>
        <h3>Review Cart and Select Payment Token</h3>
        <div>
          {/* @ts-ignore */}
          {props.cart && props.cart}
        </div>
        <select
          value={selectedToken}
          onChange={(e) => setSelectedToken(e.target.value)}
        >
          {tokens.map((token) => (
            <option key={token.address} value={token.address}>
              {token.symbol}
            </option>
          ))}
        </select>
        <button onClick={validateStep1}>Next</button>
      </div>
    );
  };

  const Step2 = () => {
    // 1: Check if gas price and native balance are still loading
    if (gasPrice === null || nativeBalance === null) {
      return (
        <div>
          <p>Checking gas and native token balance...</p>
        </div>
      );
    }

    // 2: Check for enough native tokens for transaction fees
    if (gasPrice / 10000 >= nativeBalance) {
      return (
        <div>
          <h3>Not enough native tokens to pay for transaction fee</h3>
          <button
            onClick={() => window.open("https://hop.exchange/", "_blank")}
          >
            Go to Hop Exchange
          </button>
        </div>
      );
    }

    // 3: Check if the transaction amount and token balance are still loading
    if (transactionAmount === null || tokenBalance === null) {
      return (
        <div>
          <p>Checking stream token balance...</p>
        </div>
      );
    }

    // 4: Check for enough of the selected token for the stream
    if (transactionAmount >= tokenBalance) {
      return (
        <div>
          <h3>Not enough tokens to pay for stream</h3>
          <button
            onClick={() => {
              const uniswapURL = `https://app.uniswap.org/#/swap?outputCurrency=${
                props.tokenAddress
              }&exactAmount=${
                transactionAmount - tokenBalance
              }&exactField=output`;
              window.open(uniswapURL, "_blank");
            }}
          >
            Go to Uniswap
          </button>
        </div>
      );
    }

    // 5: If all checks pass, show the slider for stream length
    return (
      <div>
        <h3>Select Stream Length & approve transaction</h3>
        <div id="CreateStream-lifetime">
          <Slider
            min={1}
            marks={marks}
            max={maxTimeDays}
            step={null}
            value={Math.min(selectedTime / SECS_PER_DAY, maxTimeDays)}
            defaultValue={1}
            onChange={(value) =>
              typeof value === "number" && setSelectedTime(SECS_PER_DAY * value)
            }
          />
        </div>
        <br />
        <div id="CreateStream-approve">
          <button
            onClick={approveStream}
            disabled={isSuccess}
            style={{ backgroundColor: isSuccess ? "grey" : "initial" }}
          >
            {`Approve ${transactionAmount} ${tokenData?.symbol}`}
          </button>
          {isLoading && <div>Waiting for your confirmation</div>}
          {isError && <div>You did not confirm the transaction</div>}
          {txLoading && (
            <div>
              Transaction approved; now waiting for transaction to be processed!
            </div>
          )}
          {txError && <div>Transaction process error.</div>}
          {txSuccess && (
            <div>
              <h3>
                Transaction has been confirmed and processed. You can proceed to
                deployment.
              </h3>
              <button onClick={validateStep2}>Next</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const daysPaid = transactionAmount / props.amountPerSecond;

  const Step3 = () => {
    return (
      <div id="CreateStream-create">
        <h3>Review params & Open Stream</h3>
        <div>
          <p>
            <strong>Total approval amount:</strong> {transactionAmount}{" "}
            {tokenData?.symbol}
          </p>
          <p>
            <strong>Days paid:</strong> {daysPaid}
          </p>
        </div>
        <button onClick={createStream}>
          {`Open Stream for ${selectedTime / SECS_PER_DAY} day${
            selectedTime !== SECS_PER_DAY ? "s" : ""
          }`}
        </button>
      </div>
    );
  };

  return (
    <div>
      {currentStep === 0 && <Step1 />}
      {currentStep === 1 && <Step2 />}
      {currentStep === 2 && <Step3 />}
    </div>
  );
};

export default CreateStream;
