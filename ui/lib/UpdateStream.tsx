import React, { useState, useEffect } from "react";
import { Stream } from "@apeworx/apepay";
import {
  usePrepareContractWrite,
  useContractWrite,
  useAccount,
  useBalance,
} from "wagmi";
import Slider from "rc-slider";

interface UpdateStreamProps {
  stream: Stream;
  onComplete: () => void;
}

const UpdateStream: React.FC<UpdateStreamProps> = (props) => {
  // Disable 'update stream' button after a user clicked on it
  const [isButtonDisabled, setButtonDisabled] = useState(false);
  // Let users select the number of days they want to fund the stream
  const [selectedTime, setSelectedTime] = useState(1);
  // Manage error handling
  const [Error, setError] = useState<string | null>(null);

  // set ERC20 allowance to selected time * stream daily cost
  const streamDailyCost = Number(props.stream.amountPerSecond) * 86400;
  const contractAmount = selectedTime * streamDailyCost;

  // Fetch user balance to determine what max amount of funds he can add
  const { address } = useAccount();
  const { data: tokenData } = useBalance({
    address,
    token: props.stream.token,
  });

  // Largest value displayed on the slider is the amount of tokens user has divided by the daily cost of his stream
  const maxTime = Number(
    (tokenData?.value || BigInt(0)) / BigInt(streamDailyCost)
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
    address: props.stream.token,
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
    args: [props.stream.streamManager.address, contractAmount],
  });

  const {
    isLoading,
    isError,
    isSuccess,
    write: approveStream,
  } = useContractWrite(approvalConfig);

  // Set step logic: (1) set amount and validate transaction & (2) update stream
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
        <>
          {maxTimeDays ? (
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
              <button onClick={approveStream} className="update-stream-button">
                {`Validate adding funds for ${selectedTime} additional day${
                  selectedTime !== 1 ? "s" : ""
                }`}
              </button>
            </>
          ) : (
            <>
              <div className="update-stream-account-loading">
                Loading your account balance...
              </div>
            </>
          )}
        </>
        {isLoading && (
          <div className="update-stream-tx-loading">
            Waiting for the transaction approval...
          </div>
        )}
        {isError && (
          <div className="update-stream-tx-error">
            You did not confirm the transaction.
          </div>
        )}
      </div>
    );
  };

  // Stream update function (for step 2)
  const handleUpdate = async () => {
    // reset the error if user clicks again on cancel
    setError(null);
    try {
      await props.stream.addTime(BigInt(contractAmount));
      // Make sure the user cannot click again on the button
      setButtonDisabled(true);
      props.onComplete();
    } catch (error) {
      setError(String(error));
      setButtonDisabled(false);
    }
  };

  // Step 2: add funds to stream
  const Step2 = () => {
    return (
      <>
        <div className="stream-container">
          <div className="update-stream-title">
            {`Add funds for ${selectedTime} additional day${
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
          <div className="update-stream-error"> {Error && Error}</div>
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
