import React, { useState } from "react";
import StreamManager from "../../sdk/js/index";
import { Address, parseUnits } from "viem";


interface UpdateStreamProps {
  creator: Address;
  streamId: number;
  sm: StreamManager;
  tokenDecimals: number,
}

const UpdateStream: React.FC<UpdateStreamProps> = (props) => {
  // Set the amount you want to add
  const [amount, setAmount] = useState<number>(0);
  // Get results of the transaction to display to the user
  const [result, setResult] = useState<string | null>(null);

  const handleUpdate = async () => {
    try {
      const result = await props.sm.update(
        props.creator,
        props.streamId,
        amount
      );
      setResult(`Stream updated. New Time left: ${result}`);
    } catch (error) {
      if (error instanceof Error) {
        setResult(`Error updating stream: ${error.message}`);
      } else {
        setResult(`Error updating stream: ${error}`);
      }
    }
  };

  return (
    <div className="update-stream-container">
      <div className="update-stream-title">
        {" "}
        Enter the amount you want to add to the stream:{" "}
      </div>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        placeholder="Update Stream"
        className="update-stream-input"
        min="0"
      />
      {amount !== 0 && (
        <>
          <button onClick={handleUpdate} className="update-stream-button">
            Update Stream
          </button>
          <div className="update-stream-label">
            {result && <div>{result}</div>}
          </div>
        </>
      )}
    </div>
  );
};

export default UpdateStream;
