import React, { useState, useEffect } from "react";
import { Stream } from "../../sdk/js/index";
import { formatTime } from "./utils";

interface CancelStreamProps {
  stream: Stream;
  onComplete: (result: string) => void;
}

const CancelStream: React.FC<CancelStreamProps> = (props) => {
  const [result, setResult] = useState<string | null>(null);
  // Allow user to cancel stream only if he didnt already click on cancel  AND if the stream is cancellable
  const [isButtonEnabled, setButtonEnabled] = useState(false);
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
      setButtonEnabled(false);
      const result = await props.stream.cancel();
      setResult(`Stream cancelled. Transaction Hash: ${result}`);
      props.onComplete(result);
    } catch (error) {
      if (error instanceof Error) {
        setResult(`Error canceling stream: ${error.message}`);
        props.onComplete(error.message);
      } else {
        setResult(`Error canceling stream: ${error}`);
        props.onComplete(String(error));
      }
    }
  };

  return (
    <div className="stream-container">
      <div className="cancel-stream-label">
        {result && (
          <div>
            {result.startsWith("Error") ? (
              <div>Error: {result}</div>
            ) : (
              <div>Stream cancelled.</div>
            )}
          </div>
        )}
        {minStreamLife === null ? (
          <div>Fetching stream minimum life...</div>
        ) : !isButtonEnabled && !result ? (
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
