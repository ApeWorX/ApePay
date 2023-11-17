import React, { useState } from "react";
import { useParams } from "react-router-dom";
import BackButton from "./BackButton";
import { CreateStream } from "@apeworx/apepay-react";
import StreamManager, { Stream } from "@apeworx/apepay";
import { TokenInfo } from "@uniswap/token-lists";
import config from "./config";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const StreamPage = () => {
  const { sm } = useParams();

  // Fake cart for the purpose of the demo
  const Cart = () => {
    return (
      <div className="cart">
        <div className="cart-item">
          <div className="cart-info">
            <span className="cart-title">Cart Title</span>
            <span className="cart-quantity">#: 1</span>
            <span className="price">$XX.00/day</span>
          </div>
          <div className="cart-details">
            <strong>Details:</strong>
            <p>Description of the cart that you are about to pay for.</p>
          </div>
        </div>
      </div>
    );
  };

  const addStreams = (stream: Stream) => {
    console.log("stream");
  };

  const tokenList: TokenInfo[] = config.tokens;

  // Generate random string (demo app only);
  const renderReasonCode = async () => {
    return Math.random().toString(36).substring(7);
  };

  const handleTransactionStatus = (
    processing: boolean,
    processed: boolean,
    error: Error | null,
  ) => {
    setIsProcessing(processing);
    setIsProcessed(processed);
    setProcessTxError(error);
  };

  // Manage results from CreateStream component
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processTxError, setProcessTxError] = useState<Error | null>(null);
  const [isProcessed, setIsProcessed] = useState<boolean>(false);

  return (
    <>
      {/* Log in */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          padding: 12,
        }}
      >
        <ConnectButton />
      </div>

      <h1>Create Stream on {sm}</h1>

      {/* Create a stream */}
      <h1> Create a stream</h1>
      <div className="create-stream-component">
        <CreateStream
          streamManagerAddress={sm as `0x${string}`}
          amountPerSecond={BigInt(100)}
          registerStream={addStreams}
          renderReasonCode={renderReasonCode}
          handleTransactionStatus={handleTransactionStatus}
          tokenList={tokenList}
          cart={<Cart />}
        />
        {/* CreateStream callback */}
        <div className="tx-status-display">
          {isProcessing && <p>Processing Transaction... </p>}
          {isProcessed && (
            <p>Transaction Successful! -redirect to another page-</p>
          )}
          {processTxError && <p>Tx Error: {processTxError.message}</p>}
        </div>
      </div>

      <BackButton />
    </>
  );
};

export default StreamPage;
