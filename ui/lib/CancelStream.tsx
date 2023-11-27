import React, { useState, useEffect } from "react";
import { Stream } from "@apeworx/apepay";
import { formatTime } from "./utils";
import { useCurrentTime } from "./utils";

interface CancelStreamProps {
  stream: Stream;
  productName?: string;
  onComplete: () => void;
}

const CancelStream: React.FC<CancelStreamProps> = (props) => {
  // Allow user to cancel stream only if the stream is cancellable
  const [isButtonEnabled, setButtonEnabled] = useState(false);
  // Allow user to cancel stream only if he didnt already click on cancel
  const [inProgress, setInProgress] = useState(false);
  // Get the minimum stream life, before which a stream cannot be Canceled
  const minStreamLife = Number(props.stream.streamManager.MIN_STREAM_LIFE);
  // Manage error handling
  const [error, setError] = useState<string | null>(null);
  // currenTime updates every second
  const currentTime = useCurrentTime();
  // Calculate the time in seconds before a stream can be cancelled
  const timeBeforeCancellability =
    Number(props.stream.startTime) + minStreamLife - currentTime;

  // Check if the stream is cancellable and set the button state accordingly.
  useEffect(() => {
    const checkStreamCancelable = () => {
      if (props.stream.isCancelable()) {
        setButtonEnabled(true);
        clearInterval(interval);
      }
    };
    checkStreamCancelable;

    // Set interval to check cancellability every 10 seconds
    const interval = setInterval(checkStreamCancelable, 10000);

    // Clean up the interval when the component unmounts or isButtonEnabled is true
    return () => clearInterval(interval);
  }, [props.stream]);

  const handleCancel = async () => {
    // reset the error if user clicks again on cancel
    setError(null);
    try {
      // Make sure the min life isnt displayed when button is clicked
      setInProgress(true);
      await props.stream.cancel();
      // Make sure the user cannot click again on the button
      setButtonEnabled(false);
      props.onComplete();
    } catch (error) {
      setError(String(error));
      // re-enable button if there was an error
      setButtonEnabled(true);
    }
  };

  return (
    <div className="stream-container">
      {!isButtonEnabled && !inProgress && timeBeforeCancellability > 0 ? (
        <>
          <div className="cancel-stream-label-min-life">
            {props.productName || "Stream"} cannot be cancelled yet: its minimum
            life is
            {formatTime(Number(minStreamLife))}.
          </div>
          <div className="cancel-stream-label-cancel-time">
            You will be able to cancel it in:
            {formatTime(Number(timeBeforeCancellability))}.
          </div>
        </>
      ) : (
        !isButtonEnabled &&
        !inProgress && (
          <div className="cancel-stream-label-loading">
            Fetching time remaining before cancellability...
          </div>
        )
      )}
      <button
        className="cancel-stream-button"
        onClick={handleCancel}
        disabled={!isButtonEnabled}
      >
        Cancel {props.productName || "Stream"}
      </button>
      <div className="cancel-stream-error"> {error && error}</div>
    </div>
  );
};
export default CancelStream;
