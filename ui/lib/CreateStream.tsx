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
  useNetwork,
} from "wagmi";
import { fetchBalance } from "@wagmi/core";
import StreamManager, { Stream } from "@apeworx/apepay";
import { TokenInfo } from "@uniswap/token-lists";


const SECS_PER_DAY = 24 * 60 * 60;

export interface CreateStreamProps {
  streamManagerAddress: Address;
  tokenList: TokenInfo[];
  amountPerSecond: number;
  cart?: ReactNode;
  registerStream: (stream: Stream) => void;
  renderReasonCode: () => Promise<string>;
  handleTransactionStatus: (
    processing: boolean,
    processed: boolean,
    error: Error | null
  ) => void;
}

const CreateStream = (props: CreateStreamProps) => {
  const [nativeBalance, setNativeBalance] = useState<number | null>(null);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [gasPrice, setGasPrice] = useState<number | null>(null);
  const { data: feeData } = useFeeData();
  const { address } = useAccount();
  const { chain } = useNetwork();
  const [selectedToken, setSelectedToken] = useState<string | null>(null);

  const { data: tokenData } = useBalance({
    address,
    token: selectedToken as `0x${string}`,
  });

  // Get balances for native tokens (or set to 1 after 8 seconds and keep fetching)
  useEffect(() => {
    let balanceCountdown: NodeJS.Timeout;
    let balanceCountdownTriggered = false;

    // Check if an address exists to proceed with fetching the balance
    if (address) {
      // Initiate a countdown timer that sets native balance to 1 after 2 seconds
      // if fetching balance takes too long
      balanceCountdown = setTimeout(() => {
        setNativeBalance(1);
        balanceCountdownTriggered = true;
      }, 8000);

      // Use fetchBalance function to asynchronously get the native token balance for the address
      fetchBalance({ address })
        .then((nativeBalanceData) => {
          if (nativeBalanceData && nativeBalanceData.formatted !== undefined) {
            // If the countdown hasn't triggered yet, clear the countdown
            if (!balanceCountdownTriggered) {
              clearTimeout(balanceCountdown);
            }
            setNativeBalance(Number(nativeBalanceData.formatted));
          }
        })
        .catch((error) => {
          console.error("Error fetching balance:", error);
        });
    }
    // Cleanup function to clear any pending countdowns
    return () => {
      clearTimeout(balanceCountdown);
    };
  }, [address]);

  // Get balances for stream tokens (or set to transactionamount * 10 after 2 seconds and keep fetching)

  useEffect(() => {
    let tokenCountdown: NodeJS.Timeout;
    let tokenCountdownTriggered = false;

    // Initiate a countdown timer to set token balance to transactionAmount + 1
    // if fetching the token balance takes too long
    if (address && selectedToken) {
      tokenCountdown = setTimeout(() => {
        setTokenBalance(transactionAmount * 10);

        tokenCountdownTriggered = true;
      }, 8000);

      if (address && selectedToken) {
        fetchBalance({
          address,
          token: selectedToken as `0x${string}`,
        })
          .then((tokenBalanceData) => {
            if (tokenBalanceData && tokenBalanceData.formatted !== undefined) {
              // Cancel the countdown if it hasn't triggered yet
              if (!tokenCountdownTriggered) {
                clearTimeout(tokenCountdown);
              }
              setTokenBalance(Number(tokenBalanceData.formatted));
            }
          })
          .catch((error) => {
            console.error("Error fetching token balance:", error);
          });
      }


    // Cleanup function to clear any pending countdowns
    return () => {
      clearTimeout(tokenCountdown);
    };
  }, [address, selectedToken]);

  // Get gas price (or set to 0 after 5 seconds and keep fetching)
  useEffect(() => {
    let gasCountdown: NodeJS.Timeout;
    let gasCountdownTriggered = false;

    // Initiate a countdown timer to set gas price to 1 after 8 seconds
    // if fetching the gas price takes too long
    gasCountdown = setTimeout(() => {
      setGasPrice(1);
      gasCountdownTriggered = true;
    }, 8000);

    // Check if the feeData object and its properties are available
    if (
      feeData &&
      feeData.formatted &&
      feeData.formatted.gasPrice !== undefined
    ) {
      // If the countdown hasn't been triggered yet, cancel it
      if (!gasCountdownTriggered) {
        clearTimeout(gasCountdown);
      }
      setGasPrice(Number(feeData.formatted.gasPrice));
    }
    // Cleanup function to clear any pending countdowns
    return () => {
      clearTimeout(gasCountdown);
    };
  }, [feeData]);

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

  const sm = new StreamManager(
    props.streamManagerAddress,
    // TODO: handle `isError`, `isLoading`
    usePublicClient(),
    useWalletClient()?.data as WalletClient
  );

  const { config: approvalConfig } = usePrepareContractWrite({
    address: selectedToken as `0x${string}`,
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
  const [txHash, setTxHash] = useState<string | undefined>(undefined);
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
    hash: txHash as `0x${string}`,
  });

  const [buttonCreateClicked, setButtonCreateClicked] = useState(false);
  const createStream = () => {
    setButtonCreateClicked(true);

    props.handleTransactionStatus(true, false, null);

    props
      .renderReasonCode()
      .then((reasonString) => {
        sm.create(
          selectedToken as `0x${string}`,
          props.amountPerSecond,
          reasonString
        )

          .then((result) => {
            props.registerStream(result);
            props.handleTransactionStatus(false, true, null);
          })
          .catch((error) => {
            props.handleTransactionStatus(false, false, error);
            setButtonCreateClicked(false);

          });
      })
      .catch((error) => {
        props.handleTransactionStatus(false, false, error);
        setButtonCreateClicked(false);

      });
  };

  // Set transaction amount
  const transactionAmount = Number(
    (
      (selectedTime * props.amountPerSecond) /
      Math.pow(10, tokenData?.decimals || 0)
    ).toFixed(Math.min(tokenData?.decimals || 0, 3))
  );


  // Get your current chainID
  let targetChainId: number | undefined;
  if (chain) {
    targetChainId = chain.id;
  }

  // reset selectedToken if chainId changes
  useEffect(() => {
    setSelectedToken(null);
  }, [targetChainId]);

  // Select the payment token among tokens with the same chainID
  const Step1 = () => {
    return (
      <div>
        <div className="cart-body">{props.cart && props.cart}</div>
        <div className="payment-flow">
          <select
            className="select-token-dropdown"
            value={selectedToken || "Select Payment Token"}
            onChange={(e) => setSelectedToken(e.target.value)}
          >
            {selectedToken === null && (
              <option disabled value="Select Payment Token">
                Select a token
              </option>
            )}
            {props.tokenList
              .filter((token) => token.chainId === targetChainId)
              .map((token) => (
                <option key={token.address} value={token.address}>
                  {token.symbol}
                </option>
              ))}
          </select>
          <button
            className="button-validate-select-token"
            onClick={() => validateStep(1)}
          >
            Next
          </button>
        </div>

      </div>
    );
  };

  const Step2 = () => {
    // 1: Check if gas price and native balance are still loading
    if (gasPrice === null || nativeBalance === null) {
      return (
        <div>
          <div className="cart-body">{props.cart && props.cart}</div>
          <div className="payment-flow">
            <div className="loading-message-balance">
              Checking gas and native token balance...
            </div>
          </div>

        </div>
      );
    }

    // 2: Check for enough native tokens for transaction fees
    if (gasPrice / 10000 >= nativeBalance) {
      return (
        <div>
          <div className="cart-body">{props.cart && props.cart}</div>
          <div className="payment-flow">
            <div className="error-message-balance">
              <p>Not enough native tokens to pay for transaction fee</p>
              <p>Your native token balance is: {nativeBalance}</p>
            </div>
            <button
              className="button-redirect-hop"
              onClick={() => window.open("https://hop.exchange/", "_blank")}
            >
              Go to Hop Exchange
            </button>
          </div>

        </div>
      );
    }

    // 3: Check if the transaction amount and token balance are still loading
    if (transactionAmount === null || tokenBalance === null) {
      return (
        <div>
          <div className="cart-body">{props.cart && props.cart}</div>
          <div className="payment-flow">
            <div className="loading-message-token-balance">
              Checking stream token balance...
            </div>
          </div>

        </div>
      );
    }

    // 4: Check for enough of the selected token for the stream
    if (transactionAmount >= tokenBalance) {
      return (
        <div>
          <div className="cart-body">{props.cart && props.cart}</div>
          <div className="payment-flow">
            <div className="error-message-balance">
              <p>Not enough tokens to pay for stream</p>
              <p>
                Your token balance is: {tokenBalance}&nbsp;{tokenData?.symbol}
              </p>
            </div>
            <button
              className="button-redirect-uniswap"
              onClick={() => {
                const uniswapURL = `https://app.uniswap.org/#/swap?outputCurrency=${selectedToken}&exactAmount=${
                  transactionAmount - tokenBalance
                }&exactField=output`;
                window.open(uniswapURL, "_blank");
              }}
            >
              Go to Uniswap
            </button>
          </div>

        </div>
      );
    }

    // 5: If all checks pass, show the slider for stream length
    return (
      <div>
        <div className="cart-body">{props.cart && props.cart}</div>
        <div className="payment-flow">
          <Slider
            className="slider-select-time"

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
          <button
            className="button-validate-transaction"

            onClick={approveStream}
            disabled={isSuccess}
            style={{ backgroundColor: isSuccess ? "grey" : "initial" }}
          >
            {`Approve ${transactionAmount}`}&nbsp;{`${tokenData?.symbol}`}
          </button>
          {isLoading && (
            <div className="validate-transaction-message">
              Waiting for your confirmation.
            </div>
          )}
          {isError && (
            <div className="validate-transaction-message">
              You did not confirm the transaction.
            </div>
          )}
          {txLoading && (
            <div className="validate-transaction-message">
              Transaction approved: you will be redirected once it has been
              processed...
            </div>
          )}
          {txError && (
            <div className="validate-transaction-message">
              Transaction process error.
            </div>
          )}
        </div>
      </div>

  const Step3 = () => {
    return (
      <div>
        <div className="cart-body">{props.cart && props.cart}</div>
        <div className="payment-flow">
          <div className="create-stream-approval-message">
            {`Total approval amount: ${transactionAmount}`}&nbsp;
            {`${tokenData?.symbol}`}
          </div>
          <button
            className="button-create-stream"
            onClick={createStream}
            disabled={buttonCreateClicked}
          >
            {`Open Stream for ${selectedTime / SECS_PER_DAY} day${
              selectedTime !== SECS_PER_DAY ? "s" : ""
            }`}
          </button>
        </div>

      </div>
    );
  };

  const [currentStep, setCurrentStep] = useState(0);
  const validateStep = (step: number) => {
    switch (step) {
      case 1:
        if (selectedToken) {
          setCurrentStep(currentStep + 1);
        } else {
          alert("Please select a valid payment token.");
        }
        break;
      case 2:
        setCurrentStep(currentStep + 1);
        break;
    }
  };

  // Monitor transaction to move to step 2 if transaction successful
  useEffect(() => {
    if (txSuccess) {
      validateStep(2);
    }
  }, [txSuccess]);

  // Switch logic to accompany the user when processing his transaction
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return <Step1 />;
      case 1:
        return <Step2 />;
      case 2:
        return <Step3 />;
      default:
        return null;
    }
  };

  return <>{renderCurrentStep()}</>;
};

export default CreateStream;
