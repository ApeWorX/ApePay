import React, { useState, useEffect } from "react";
import { Stream } from "../../sdk/js/index";
import { formatTime } from "./utils";
import { getCurrentTime } from "./utils";

interface CancelStreamProps {
  stream: Stream;
  onComplete: (success: boolean) => void;
}

const CancelStream: React.FC<CancelStreamProps> = (props) => {
  // Allow user to cancel stream only if the stream is cancellable
  const [isButtonEnabled, setButtonEnabled] = useState(false);
  // Allow user to cancel stream only if he didnt already click on cancel
  const [inProgress, setInProgress] = useState(false);
  // Get the minimum stream life, before which a stream cannot be Canceled
  const minStreamLife = Number(props.stream.streamManager.MIN_STREAM_LIFE);
  // Get the starting time of a stream
  const [startTime, setStartTime] = useState<number>(0);
  // Manage error handling
  const [Error, setError] = useState<string | null>(null);
  // Set currenTime state to update it very second
  const [currentTime, setCurrentTime] = useState<number>(0);

  // Check if the stream is cancellable and set the button state accordingly.
  useEffect(() => {
    // Check if the stream is cancellable and set the button state accordingly
    const checkStreamCancelable = async () => {
      try {
        const isCancelable = await props.stream.isCancelable();
        setButtonEnabled(isCancelable);
        if (isCancelable) {
          clearInterval(interval);
        }
      } catch (error) {
        console.error("Error checking stream cancellability:", error);
      }
    };
    checkStreamCancelable;

    // Set interval to check cancellability every 10 seconds
    const interval = setInterval(checkStreamCancelable, 10000);

    // Clean up the interval when the component unmounts or isButtonEnabled is true
    return () => clearInterval(interval);
  }, [props.stream]);

  const handleCancel = async () => {
    try {
      // Make sure the min life isnt displayed when button is clicked
      setInProgress(true);
      // Make sure the user cannot click again on the button
      setButtonEnabled(false);
      await props.stream.cancel();
      props.onComplete(true);
    } catch (error) {
      setError(String(error));
      setButtonEnabled(true);
    }
  };

  // Fetch starttime
  useEffect(() => {
    const getStartTime = async () => {
      try {
        const streamInfo = await props.stream.streamInfo();
        setStartTime(Number(streamInfo.start_time));
        if (streamInfo && streamInfo.start_time !== 0n) {
          clearInterval(interval);
        }
      } catch (error) {
        console.error("Error getting stream token");
      }
    };
    const interval = setInterval(getStartTime, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  // Fetch current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getCurrentTime());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Calculate the time in seconds before a stream can be cancelled
  const timeBeforeCancellability = startTime + minStreamLife - currentTime;

  return (
    <div className="stream-container">
      <div className="cancel-stream-label">
        {minStreamLife === null ? (
          <div>Fetching stream minimum life...</div>
        ) : !isButtonEnabled && !inProgress && startTime !== 0 ? (
          <div>
            Deployment cannot be cancelled yet: its minimum life is
            {formatTime(Number(minStreamLife))}.
            <div>
              You will be able to cancel it in:
              {formatTime(Number(timeBeforeCancellability))}.
            </div>
          </div>
        ) : (
          <div>Fetching time remaining before cancellability...</div>
        )}
      </div>
      <button
        className="cancel-stream-button"
        onClick={handleCancel}
        disabled={!isButtonEnabled}
      >
        Cancel Stream
      </button>
      {Error && Error}
    </div>
  );
};
export default CancelStream;
