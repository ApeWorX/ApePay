import React, { useState, useEffect, ReactNode } from "react";
import Slider from "rc-slider";
import { Address, WalletClient } from "viem";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useWalletClient,
  usePrepareContractWrite,
  useContractWrite,
  useWaitForTransaction,
  useNetwork,
} from "wagmi";
import { fetchBalance } from "@wagmi/core";
import StreamManager, { Stream } from "@apeworx/apepay";
import { TokenInfo } from "@uniswap/token-lists";
import { roundTxDecimals } from "./utils";

const SECS_PER_DAY = 24 * 60 * 60;

export interface CreateStreamProps {
  streamManagerAddress: Address;
  tokenList: TokenInfo[];
  amountPerSecond: bigint;
  cart?: ReactNode;
  registerStream: (stream: Stream) => void;
  renderReasonCode: () => Promise<string>;
  handleTransactionStatus: (
    processing: boolean,
    processed: boolean,
    error: Error | null,
  ) => void;
}

const CreateStream = (props: CreateStreamProps) => {
  const [nativeBalance, setNativeBalance] = useState<number | null>(null);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const { address } = useAccount();
  const { chain } = useNetwork();
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);

  const [SM, setSM] = useState<StreamManager | null>(null);
  const publicClient = usePublicClient();
  const walletClient = useWalletClient().data as WalletClient;

  // Fetch the stream manager
  useEffect(() => {
    if (SM === null && walletClient !== undefined) {
      StreamManager.fromAddress(
        props.streamManagerAddress as `0x${string}`,
        publicClient,
        walletClient,
      )
        .then(setSM)
        .catch(console.error);
    }
  }, [SM, walletClient]);

  const { data: tokenData } = useBalance({
    address,
    token: selectedToken?.address as `0x${string}`,
  });

  // Get balances for native tokens
  useEffect(() => {
    const fetchAndSetNativeBalance = () => {
      if (address) {
        // Fetch the balance
        fetchBalance({ address })
          .then((nativeBalanceData) => {
            if (nativeBalanceData && nativeBalanceData.formatted != undefined) {
              const fetchedBalance = Number(nativeBalanceData.formatted);
              setNativeBalance(fetchedBalance);
              // clear the interval when fetched balance is not null
              if (fetchedBalance) {
                clearInterval(intervalID);
              }
            }
          })
          .catch((error) => {
            console.error("Error fetching native balance:", error);
            // Don't block the transaction process if there is an error when fetching the balance
            setNativeBalance(10000);
          });
      }
    };
    fetchAndSetNativeBalance;

    // Keep fetching every second
    const intervalID = setInterval(fetchAndSetNativeBalance, 1000);

    // Cleanup when component dismounts
    return () => {
      clearInterval(intervalID);
    };
  }, [address]);

  // Get balances for stream tokens after a stream token has been selected
  useEffect(() => {
    const fetchAndSetTokenBalance = () => {
      if (address && selectedToken) {
        fetchBalance({
          address,
          token: selectedToken.address as `0x${string}`,
        })
          .then((tokenBalanceData) => {
            if (tokenBalanceData && tokenBalanceData.formatted != undefined) {
              const fetchedTokenBalance = Number(tokenBalanceData.formatted);
              setTokenBalance(fetchedTokenBalance);
              // clear the interval when fetched balance is not null
              if (fetchedTokenBalance) {
                clearInterval(tokenInterval);
              }
            }
          })
          .catch((error) => {
            console.error("Error fetching token balance:", error);
            // Don't block the transaction process if there is an error when fetching the balance
            setTokenBalance(10000);
          });
      }
    };
    fetchAndSetTokenBalance;

    // Keep fetching every second
    const tokenInterval = setInterval(fetchAndSetTokenBalance, 1000);

    // Cleanup when component dismounts
    return () => {
      clearInterval(tokenInterval);
    };
  }, [address, selectedToken]);

  const maxTime = Number(
    (tokenData?.value || BigInt(0)) / BigInt(props.amountPerSecond),
  );

  // TODO: Increase stability of deployments beyond a week
  const maxTimeDays: number = Math.min(Math.floor(maxTime / SECS_PER_DAY), 7); // Up to a week
  const marks = Object.fromEntries(
    Array.from(Array(maxTimeDays).keys()).map((v: number) => [
      v + 1,
      `${v + 1}`,
    ]),
  );

  const [selectedTime, setSelectedTime] = useState(SECS_PER_DAY); // Defaults 1 day

  const txCost = selectedTime * Number(props.amountPerSecond);
  const roundedTxDecimals = roundTxDecimals(txCost, selectedToken);

  // Set transaction amount
  const transactionAmount = Number(
    (
      (selectedTime * Number(props.amountPerSecond)) /
      Math.pow(10, selectedToken?.decimals || 0)
    ).toFixed(Math.min(selectedToken?.decimals || 0, 3)),
  );

  const { config: approvalConfig } = usePrepareContractWrite({
    address: selectedToken?.address as `0x${string}`,
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
    args: [SM?.address, roundedTxDecimals],
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
        SM?.create(
          selectedToken?.address as `0x${string}`,
          props.amountPerSecond,
          reasonString,
        )
          .then((result) => {
            props.handleTransactionStatus(false, true, null);
            props.registerStream(result);
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
            value={
              selectedToken ? selectedToken.address : "Select Payment Token"
            }
            onChange={(e) => {
              // Find the TokenInfo object that matches the selected address
              const selectedTokenInfo = props.tokenList.find(
                (token) => token.address === e.target.value,
              );
              setSelectedToken(selectedTokenInfo || null);
            }}
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
    // 1: Check if SM is still fetching
    if (SM === null) {
      return (
        <div>
          <div className="cart-body">{props.cart && props.cart}</div>
          <div className="payment-flow">
            <div className="fetching-sm-message">
              Fetching stream manager address...
            </div>
          </div>
        </div>
      );
    }

    // 1: Check if native balance is still fetching
    if (nativeBalance === null) {
      return (
        <div>
          <div className="cart-body">{props.cart && props.cart}</div>
          <div className="payment-flow">
            <div className="loading-message-balance">
              Checking native token balance...
            </div>
          </div>
        </div>
      );
    }

    // 2: Check for enough native tokens for transaction fees
    if (nativeBalance < 0.001) {
      return (
        <div>
          <div className="cart-body">{props.cart && props.cart}</div>
          <div className="payment-flow">
            <div className="error-message-balance">
              <p>Not enough native tokens to pay for transaction fees</p>
              <p>
                Your native token balance is:&nbsp;{nativeBalance.toFixed(4)}
              </p>
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
    if (tokenBalance === null) {
      return (
        <div>
          <div className="cart-body">{props.cart && props.cart}</div>
          <div className="payment-flow">
            <div className="loading-message-token-balance">
              Checking token balance...
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
              <div>Not enough tokens to pay for transaction.</div>
              <div>
                Your token balance is: {tokenBalance.toFixed(2)}&nbsp;
                {selectedToken?.symbol} but the transaction costs&nbsp;
                {transactionAmount}&nbsp;{selectedToken?.symbol}
              </div>
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
            disabled={isSuccess}
          />
          <button
            className="button-validate-transaction"
            onClick={approveStream}
            disabled={isSuccess}
            style={{ backgroundColor: isSuccess ? "grey" : "initial" }}
          >
            {`Approve ${Math.floor(transactionAmount + 1)}`}&nbsp;
            {`${selectedToken?.symbol}`}
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
              Transaction process error: {String(txError)}.
            </div>
          )}
        </div>
      </div>
    );
  };

  const Step3 = () => {
    return (
      <div>
        <div className="cart-body">{props.cart && props.cart}</div>
        <div className="payment-flow">
          <div className="create-stream-approval-message">
            {`Total approval amount: ${Math.floor(transactionAmount + 1)}`}
            &nbsp;
            {`${selectedToken?.symbol}`}
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
