import React, { useState, useEffect } from "react";
import { stringToHex } from "viem";
import StreamManager, { Stream } from "../../sdk/js/index";
import { formatTime } from "./utils";

interface CancelStreamProps {
  stream: Stream;
  reason: string;
  sm: StreamManager;
  onComplete: (result: string) => void;
}

const CancelStream: React.FC<CancelStreamProps> = (props) => {
  const [result, setResult] = useState<string | null>(null);
  const hexReason = stringToHex(props.reason);
  // Allow user to cancel stream only if he didnt click on cancel already AND if the stream is cancellable
  const [isButtonEnabled, setButtonEnabled] = useState(false);
  // Get the min stream life
  const [minStreamLife, setMinStreamLife] = useState<number | null>(null);

  // Retrieve the value of the min stream life
  async function fetchMinStreamLife() {
    try {
      const minStreamLife = await props.sm.MIN_STREAM_LIFE();
      setMinStreamLife(minStreamLife);
    } catch (error) {
      console.error("Error fetching MIN_STREAM_LIFE:", error);
    }
  }
  fetchMinStreamLife();

  // Check if the stream is cancellable and set the button state accordingly.
  const checkStreamCancellable = async () => {
    try {
      const isCancellable = await props.sm.stream_is_cancelable(
        props.stream.creator,
        props.stream.streamId
      );
      setButtonEnabled(isCancellable);
      if (isCancellable) {
        clearInterval(interval);
      }
    } catch (error) {
      console.error("Error checking stream cancellability:", error);
    }
  };
  checkStreamCancellable();

  // Set interval to check every 10 seconds
  const interval = setInterval(checkStreamCancellable, 10000);

  // Clean up the interval when the component unmounts
  useEffect(() => {
    return () => clearInterval(interval);
  }, []);

  const handleCancel = async () => {
    try {
      setButtonEnabled(false);
      const result = await props.sm.cancel(
        props.stream.streamId,
        hexReason,
        props.stream.creator
      );
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
      <button
        className="cancel-stream-button"
        onClick={handleCancel}
        disabled={!isButtonEnabled}
      >
        Cancel Stream
      </button>
      <div className="cancel-stream-label">
        {result && <div>Stream cancelled.</div>}
        {!isButtonEnabled && (
          <div>
            Stream cannot be cancelled yet: its minimum life is
            {formatTime(Number(minStreamLife))}.
          </div>
        )}
      </div>
    </div>
  );
};
export default CancelStream;
