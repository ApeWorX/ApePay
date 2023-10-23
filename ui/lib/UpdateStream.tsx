import React, { useState, useEffect } from "react";
import { Stream } from "../../sdk/js/index";
import {
  usePrepareContractWrite,
  useContractWrite,
  useAccount,
  useBalance,
} from "wagmi";
import Slider from "rc-slider";

interface UpdateStreamProps {
  stream: Stream;
  onComplete: (error: string | boolean) => void;
}

const UpdateStream: React.FC<UpdateStreamProps> = (props) => {
  // Get the token address of the stream
  const [streamToken, setStreamToken] = useState<`0x${string}` | null>(null);
  // Disable 'update stream' button after a user clicked on it
  const [isButtonDisabled, setButtonDisabled] = useState(false);
  // Let users select the number of days they want to fund the stream
  const [selectedTime, setSelectedTime] = useState(1);

  // Fetch the stream token to prepare approval transaction
  useEffect(() => {
    const getStreamToken = async () => {
      try {
        const streamInfo = await props.stream.streamInfo();
        setStreamToken(streamInfo.token);
        if (streamToken) {
          clearInterval(interval);
        }
      } catch (error) {
        console.error("Error getting stream token");
      }
    };

    // Set interval to check streamtoken
    const interval = setInterval(getStreamToken, 1000);

    // Clean up the interval when the component unmounts or streamToken is set
    return () => clearInterval(interval);
  }, [streamToken]);

  // set ERC20 allowance to selected time * stream daily cost
  const streamDailyCost = props.stream.amountPerSecond * 86400;
  const contractAmount = selectedTime * streamDailyCost;

  // Fetch user balance to determine what max amount of funds he can add
  const { address } = useAccount();
  const { data: tokenData } = useBalance({
    address,
    token: streamToken as `0x${string}`,
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
    address: streamToken as `0x${string}`,
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

  // Set step logic: (1) set amount, check updatability, and validate transaction & (2) update stream
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
            <button
            onClick={approveStream}
            className="update-stream-button"
            disabled={streamToken === null}
          >
            {`Validate adding funds for ${selectedTime} new day${
              selectedTime !== 1 ? "s" : ""
            }`}
          </button>
          </>
          ) : (
            <>
            <p> Loading your account balance...</p>
            </>
          )}
        </>

        {isLoading && <p>Waiting for the transaction approval...</p>}
        {isError && <p>You did not confirm the transaction.</p>}
      </div>
    );
  };

  // Stream update function (for step 2)
  const handleUpdate = async () => {
    try {
      // Make sure the user cannot click again on the button
      setButtonDisabled(true);
      await props.stream.addTime(BigInt(contractAmount));
      props.onComplete(true);
    } catch (error) {
      if (error instanceof Error) {
        props.onComplete(error.message);
        setButtonDisabled(false);
      } else {
        props.onComplete(String(error));
        setButtonDisabled(false);
      }
    }
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
