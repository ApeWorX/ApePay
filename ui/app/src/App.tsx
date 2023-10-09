import React from "react";
import { useState } from "react";
import { Stream } from "@apeworx/apepay";
import { TokenInfo } from "@uniswap/token-lists";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  usePublicClient,
  useWalletClient,
  WalletClient,
  useAccount,
} from "wagmi";
import config from "./config";
// NOTE: Do this or else it won't render (or create your own CSS)
import "rc-slider/assets/index.css";
import "./styles.css";
// import { CreateStream, StreamStatus } from "@apeworx/apepay-react";
// import { StreamStatus } from "@apeworx/apepay-react";
import CreateStream from "../../../ui/lib/CreateStream";
import StreamStatus from "../../../ui/lib/StreamStatus";
import StreamStatusBar from "../../../ui/lib/StreamStatusBar";

function App() {
  const tokenList: TokenInfo[] = config.tokens;

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
            <p>Description of the cart that you're about to pay for.</p>
          </div>
        </div>
      </div>
    );
  };

  // Manage status of stream transaction
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

  const { address } = useAccount();
  const [streamId, setStreamId] = useState<number | null>(null);

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
        {isProcessed && (
          <p>Transaction Successful! -redirect to another page-</p>
        )}
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
          streamManagerAddress={config.streamManagerAddress as `0x${string}`}
          amountPerSecond={100}
          registerStream={(s: Stream) => {
            console.log(s);
            setStreamId(s.streamId);
          }}
          renderReasonCode={renderReasonCode}
          handleTransactionStatus={handleTransactionStatus}
          tokenList={tokenList}
          cart={<Cart />}
        />
      </div>

      <div className="status-graph">
        {streamId ? (
          <>
            <StreamStatus
              stream={
                new Stream(
                  config.streamManagerAddress as `0x${string}`,
                  address as `0x${string}`,
                  // todo: get streamID
                  streamId,
                  usePublicClient(),
                  useWalletClient()?.data as WalletClient
                )
              }
            />

            <StreamStatusBar
              stream={
                new Stream(
                  config.streamManagerAddress as `0x${string}`,
                  address as `0x${string}`,
                  // todo: get streamID
                  streamId,
                  usePublicClient(),
                  useWalletClient()?.data as WalletClient
                )
              }
            />
          </>
        ) : (
          <p>Create a deployment in order to see its graph.</p>
        )}
      </div>

      {console.log("stream " + Stream)}
      {console.log("stream manager address" + config.streamManagerAddress)}
      {console.log("address " + address)}
      {console.log("usepublicclient " + usePublicClient())}
      {console.log("streamid " + streamId)}
    </>
  );
}

export default App;
