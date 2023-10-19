import React, { useState, useEffect } from "react";
import StreamManager, { Stream } from "../../sdk/js/index";
import {
  usePrepareContractWrite,
  useContractWrite,
  useAccount,
  useBalance,
} from "wagmi";
import Slider from "rc-slider";

interface UpdateStreamProps {
  stream: Stream;
  streamDailyCost: bigint;
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
  // Get result of transaction to display to the user
  const [result, setResult] = useState<string | null>(null);
  // Disable 'update stream' button after a user clicked on it
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

  // Validate first transaction
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
    args: [props.stream.address, contractAmount],
  });

  const {
    isLoading,
    isError,
    isSuccess,
    write: approveStream,
  } = useContractWrite(approvalConfig);

  // Make sure stream is updatable (timemax not reached) before validating transaction
  const [isValidateButtonDisabled, setValidateButtonDisabled] = useState(true);
  // Check if timemax has been checked to display a loading message
  const [isUpdatableChecked, setIsUpdatableChecked] = useState(false);
  const checkStreamUpdatable = async () => {
    try {
      setIsUpdatableChecked(true);
      const streamInfo = await props.stream.streamInfo();
      const currentTime = Math.floor(Date.now() / 1000);
      const startTime = streamInfo.start_time;
      const timeRemaining =
        Number(startTime) + Number(streamInfo.max_stream_life) - currentTime;

      const isUpdatable = timeRemaining > 0;
      setValidateButtonDisabled(!isUpdatable);
    } catch (error) {
      console.error("Error checking stream updatability:", error);
    }
  };

  // Set interval to check every 10 seconds
  const interval = setInterval(checkStreamUpdatable, 10000);
  // Clean up the interval when the component unmounts
  useEffect(() => {
    return () => clearInterval(interval);
  }, []);

  // Set step logic: (1) set amount, check updatability, and validate transaction & (2) update stream
  const [currentStep, setCurrentStep] = useState(1);

  // Move to step 2 if transaction has been succesful
  useEffect(() => {
    if (isSuccess) {
      setCurrentStep(2);
    }
  }, [isSuccess]);

  // Step 1: set number of tokens you want to add and check if stream is updatable
  const Step1 = () => {
    return (
      <div className="stream-container">
        {!isUpdatableChecked ? (
          <div className="update-message">Fetching max stream life...</div>
        ) : isValidateButtonDisabled ? (
          <div className="update-message">
            Max stream life reached: stream cannot be updated.
          </div>
        ) : (
          <>
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
          </>
        )}
        <button
          onClick={approveStream}
          className="update-stream-button"
          disabled={isValidateButtonDisabled}
        >
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
            {result && result.startsWith("Error") ? (
              <div>{result}</div>
            ) : result ? (
              <div>
                {`Your stream has been funded for ${selectedTime} more day${
                  selectedTime !== 1 ? "s" : ""
                }`}
              </div>
            ) : null}
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
