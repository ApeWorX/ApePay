import React, { useState, useEffect } from "react";
import StreamManager, { Stream } from "../../sdk/js/index";
import {
  usePrepareContractWrite,
  useContractWrite,
  useAccount,
  useBalance,
} from "wagmi";
import { formatTime } from "./utils";
import Slider from "rc-slider";

interface UpdateStreamProps {
  stream: Stream;
  streamDailyCost: number;
  sm: StreamManager;
  token: {
    chainId: number;
    address: string;
    name: string;
    decimals: number;
    symbol: string;
  };
}

const UpdateStream: React.FC<UpdateStreamProps> = (props) => {
  // Display time left for the user
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  // Get result of transaction to display to the user
  const [result, setResult] = useState<string | null>(null);
  // Allow user to update stream only once
  const [isButtonDisabled, setButtonDisabled] = useState(false);
  // Let users select the number of days they want to fund the stream
  const [selectedTime, setSelectedTime] = useState(1);

  // set ERC20 allowance
  const contractAmount = BigInt(selectedTime) * BigInt(props.streamDailyCost);

  // Fetch user balance to determine what max amount of funds he can add
  const { address } = useAccount();
  const { data: tokenData } = useBalance({
    address,
    token: props.token.address as `0x${string}`,
  });

  // Largest value displayed on the slider is the amount of tokens you have divided by the daily cost of your stream
  const maxTime = Number(
    (tokenData?.value || BigInt(0)) / BigInt(props.streamDailyCost)
  );
  const maxTimeDays: number = Math.min(Math.floor(maxTime), 7); // Up to a week

  // Define steps in the slider
  const marks = Object.fromEntries(
    Array.from(Array(maxTimeDays).keys()).map((v: number) => [
      v + 1,
      `${v + 1}`,
    ])
  );

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
      <div className="stream-container">
        {timeLeft !== null ? (
          <div>Remaining time in the stream: {formatTime(timeLeft)}.</div>
        ) : (
          <div>Fetching remaining time...</div>
        )}
        <Slider
          className="slider-select-time"
          min={1}
          marks={marks}
          max={maxTimeDays}
          step={null}
          value={Math.min(selectedTime, maxTimeDays)}
          defaultValue={1}
          onChange={(value) =>
            typeof value === "number" && setSelectedTime(value)
          }
        />
        <button onClick={approveStream} className="update-stream-button">
          {`Validate adding funds for ${selectedTime} new day${
            selectedTime !== 1 ? "s" : ""
          }`}
        </button>
        {isLoading && <p>Waiting for the transaction approval...</p>}
        {isError && <p>You did not confirm the transaction.</p>}
      </div>
    );
  };

  // Stream update function (for step 2)
  const handleUpdate = async () => {
    try {
      setButtonDisabled(true);
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
    console.log(result);
  };

  // Step 2: add funds to stream
  const Step2 = () => {
    return (
      <>
        <div className="stream-container">
          <div className="update-stream-title">
            {`Add funds for ${selectedTime} new day${
              selectedTime !== 1 ? "s:" : ":"
            }`}
          </div>
          <button
            onClick={handleUpdate}
            disabled={isButtonDisabled}
            className="update-stream-button"
          >
            Fund stream
          </button>
          <div className="update-stream-label">
            {result && (
              <div>
                Your stream has been funded for {selectedTime} more days.
              </div>
            )}
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
