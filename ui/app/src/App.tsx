import React from "react";
import { useState } from "react";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Stream } from "@apeworx/apepay";

// import { CreateStream, StreamStatus } from "@apeworx/apepay-react";
import { StreamStatus } from "@apeworx/apepay-react";
import CreateStream from "../../../ui/lib/CreateStream";
// NOTE: Do this or else it won't render (or create your own CSS)
import "rc-slider/assets/index.css";

function App() {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processTxError, setProcessTxError] = useState<Error | null>(null);
  const [isProcessed, setIsProcessed] = useState<boolean>(false);

  const handleTransactionStatus = (
    processing: boolean,
    processed: boolean,
    error: Error | null
  ) => {
    setIsProcessing(processing);
    setIsProcessed(processed);
    setProcessTxError(error);
  };

  // random string for the demo;
  const renderReasonCode = async () => {
    return Math.random().toString(36).substring(7);
  };

  return (
    <>
      {/* LOG IN WITH WALLET */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          padding: 12,
        }}
      >
        <ConnectButton />
      </div>

      {/* Transaction Status Display */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "10vh",
        }}
      >
        {isProcessing && <p>Processing Transaction... </p>}
        {isProcessed && <p>Transaction Successful!</p>}
        {processTxError && <p>Error: {processTxError.message}</p>}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "30vh",
        }}
      >
        <CreateStream
          streamManagerAddress={"0xb5ED1eF2a90527b402Cd7e7d415027CB94E1Db4E"}
          tokenAddress={"0x0579FC0e764E7CC10c7175533B1330B184B8D505"}
          amountPerSecond={100000000000000}
          registerStream={(s: Stream) => console.log(s)}
          renderReasonCode={renderReasonCode}
          handleTransactionStatus={handleTransactionStatus}
        />
      </div>
    </>
  );
}

export default App;
