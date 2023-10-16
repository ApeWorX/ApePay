import React, { useState } from "react";
import StreamManager from "../../sdk/js/index";
import { Address, stringToHex } from "viem";

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
      setResult(`Stream cancelled. Remaining funds: ${result}`);
    } catch (error) {
      if (error instanceof Error) {
        setResult(`Error canceling stream: ${error.message}`);
      } else {
        setResult(`Error canceling stream: ${error}`);
      }
    }
  };

  return (
    <div>
      <button className="button-cancel-stream" onClick={handleCancel}>
        Cancel Stream
      </button>
      <div className="cancel-result-label">{result && <div>{result}</div>}</div>
    </div>
  );
};

export default CancelStream;
