import React, { useState, useEffect } from "react";
import { parseUnits } from "viem";
import StreamManager, { Stream } from "../../sdk/js/index";
import { usePrepareContractWrite, useContractWrite } from "wagmi";

interface UpdateStreamProps {
  stream: Stream;
  sm: StreamManager;
  token: {
    chainId: number;
    address: string;
    name: string;
    decimals: number;
    symbol: string;
  };
}
// TODO: let user choose time with a slider instead of an amount of tokens

const UpdateStream: React.FC<UpdateStreamProps> = (props) => {
  // Display time left for the user
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  // Set the amount user wants to add
  const [amount, setAmount] = useState<string>("0");
  // Get result of transaction to display to the user
  const [result, setResult] = useState<string | null>(null);

  // Get time left in the stream
  useEffect(() => {
    props.stream.timeLeft().then(setTimeLeft).catch(console.error);

    // Skip the interval if timeLeft is null
    if (timeLeft !== null) {
      const intervalId = setInterval(() => {
        setTimeLeft((prevTimeLeft) =>
          prevTimeLeft !== null ? Math.max(prevTimeLeft - 1, 0) : null
        );
      }, 3000);

      // Clear the interval when the component is unmounted
      return () => clearInterval(intervalId);
    }
  }, [props.stream]);

  // set ERC20 allowance
  const contractAmount = parseUnits(amount, props.token.decimals);
  const { config: approvalConfig } = usePrepareContractWrite({
    address: props.token.address as `0x${string}`,
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
    args: [props.sm.address, contractAmount],
  });

  const {
    isLoading,
    isError,
    isSuccess,
    write: approveStream,
  } = useContractWrite(approvalConfig);

  // Set step logic: set amount and validate transaction (1) then update stream (2)
  const [currentStep, setCurrentStep] = useState(1);

  // Move to step 2 if transaction has been succesful
  useEffect(() => {
    if (isSuccess) {
      setCurrentStep(2);
    }
  }, [isSuccess]);

  // Step 1: set number of tokens you want to add
  const Step1 = () => {
    return (
      <div className="update-stream-container">
        <div>Remaining time in the stream: {timeLeft}.</div>
        <div className="update-stream-title">
          Enter the amount of {props.token.symbol} you want to add to the
          stream:
        </div>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Update Stream"
          className="update-stream-input"
          min="0"
        />
        <button
          onClick={approveStream}
          disabled={amount === "0"}
          className="update-stream-button"
        >
          Validate {amount} {props.token.symbol} to proceed to stream update
        </button>
        {isLoading && <p>Waiting for the transaction approval...</p>}
        {isError && <p>You did not confirm the transaction.</p>}
      </div>
    );
  };

  // Stream update function (for step 2)
  const handleUpdate = async () => {
    try {
      const result = await props.sm.update(
        props.stream.creator,
        props.stream.streamId,
        contractAmount
      );
      setResult(`Stream updated. Transaction Hash: ${result}`);
    } catch (error) {
      if (error instanceof Error) {
        setResult(`Error updating stream: ${error.message}`);
      } else {
        setResult(`Error updating stream: ${error}`);
      }
    }
  };

  // Step 2: add funds to stream
  const Step2 = () => {
    return (
      <>
        <div className="stream-container">
          <div className="update-stream-title">
            Add {amount} {props.token.symbol} to the stream:
          </div>
          <button onClick={handleUpdate} className="update-stream-button">
            Update Stream
          </button>
          <div className="update-stream-label">
            {result && <div>{result}</div>}
          </div>
        </div>
      </>
    );
  };

  // Switch logic to accompany the user when processing his transaction
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1 />;
      case 2:
        return <Step2 />;
    }
  };

  return <>{renderCurrentStep()}</>;
};

export default UpdateStream;
