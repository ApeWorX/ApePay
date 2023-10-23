import React, { useState, useEffect } from "react";
import { Stream } from "../../sdk/js/index";
import { formatTime } from "./utils";

interface CancelStreamProps {
  stream: Stream;
  onComplete: (error: string | boolean) => void;
}

const CancelStream: React.FC<CancelStreamProps> = (props) => {
  // Allow user to cancel stream only if the stream is cancellable
  const [isButtonEnabled, setButtonEnabled] = useState(true);
  // Allow user to cancel stream only if he didnt already click on cancel
  const [inProgress, setInProgress] = useState(false);
  // Get the minimum stream life, before which a stream cannot be Canceled
  const minStreamLife = props.stream.streamManager.MIN_STREAM_LIFE;

  // Check if the stream is cancellable and set the button state accordingly.
  const checkStreamCancelable = async () => {
    try {
      const isCancelable = await props.stream.isCancelable();
      setButtonEnabled(isCancelable);
      // clean up interval if stream can be cancelled
      if (isCancelable) {
        clearInterval(interval);
      }
    } catch (error) {
      console.error("Error checking stream cancellability:", error);
    }
  };

  // Set interval to check cancellability every 10 seconds
  const interval = setInterval(checkStreamCancelable, 10000);
  // Clean up the interval when the component unmounts
  useEffect(() => {
    return () => clearInterval(interval);
  }, []);

  const handleCancel = async () => {
    try {
      // Make sure the min life isnt displayed when button is clicked
      setInProgress(true);
      // Make sure the user cannot click again on the button
      setButtonEnabled(false);
      await props.stream.cancel();
      props.onComplete(true);
    } catch (error) {
      if (error instanceof Error) {
        props.onComplete(error.message);
      } else {
        props.onComplete(String(error));
      }
    }
  };

  return (
    <div className="stream-container">
      <div className="cancel-stream-label">
        {minStreamLife === null ? (
          <div>Fetching stream minimum life...</div>
        ) : !isButtonEnabled && !inProgress ? (
          <div>
            Stream cannot be cancelled yet: its minimum life is
            {formatTime(Number(minStreamLife))}.
          </div>
        ) : null}
      </div>
      <button
        className="cancel-stream-button"
        onClick={handleCancel}
        disabled={!isButtonEnabled}
      >
        Cancel Stream
      </button>
    </div>
  );
};
export default CancelStream;
