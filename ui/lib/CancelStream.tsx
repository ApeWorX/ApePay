import React, { useState } from "react";
import { Address, stringToHex } from "viem";
import StreamManager from "../../sdk/js/index";

interface CancelStreamProps {
  streamId: number;
  reason: string;
  creator: Address;
  sm: StreamManager;
}

const CancelStream: React.FC<CancelStreamProps> = (props) => {
  const [result, setResult] = useState<string | null>(null);
  const hexReason = stringToHex(props.reason);

  // console.log(props.streamId);
  // console.log(hexReason);
  // console.log(props.creator);
  // console.log(props.sm);

  const handleCancel = async () => {
    try {
      const result = await props.sm.cancel(
        props.streamId,
        hexReason,
        props.creator
      );
      setResult(`Stream cancelled. Transaction Hash: ${result}`);
    } catch (error) {
      if (error instanceof Error) {
        setResult(`Error canceling stream: ${error.message}`);
      } else {
        setResult(`Error canceling stream: ${error}`);
      }
    }
  };

  return (
    <div className="cancel-stream-container">
      <button className="cancel-stream-button" onClick={handleCancel}>
        Cancel Stream
      </button>
      <div className="cancel-stream-label">{result && <div>{result}</div>}</div>
    </div>
  );
};

export default CancelStream;
