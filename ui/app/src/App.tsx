import React from "react";
import { useState, useEffect } from "react";
import { TokenInfo } from "@uniswap/token-lists";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { WalletClient, Address } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import config from "./config";
// NOTE: Do this or else it won't render (or create your own CSS)
import "rc-slider/assets/index.css";
import "./styles.css";
import CreateStream from "lib/CreateStream";
import StreamStatus from "lib/StreamStatus";
import CancelStream from "lib/CancelStream";
import UpdateStream from "lib/UpdateStream";
import StreamManager, { Stream } from "sdk/js/index";

function App() {
  const tokenList: TokenInfo[] = config.tokens;
  const [chartType, setChartType] = useState<"bar" | "pie">("bar");

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

  const [stream, setStream] = useState<Stream | null>(null);

  // Get streamManager to pass it as props to cancelstream
  const sm = new StreamManager(
    config.streamManagerAddress as Address,
    usePublicClient(),
    useWalletClient()?.data as WalletClient
  );

  // Get the reason to pass it as props to cancelstream
  const [reason, setReason] = useState("");
  useEffect(() => {
    const fetchReason = async () => {
      try {
        const reasonCode = await renderReasonCode();
        setReason(reasonCode);
      } catch (error) {
        console.error("Error fetching reason code:", error);
      }
    };

    fetchReason();
  }, []);

  //find token decimals for update stream component. TODO: fetch dynamically as stream.token
  const selectedToken = config.tokens[2];

  // Callback function to handle result from cancel component
  const [cancelResult, setCancelResult] = useState<string | null>(null);
  const handleCancelComplete = (result: string | null) => {
    setCancelResult(result);
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
          registerStream={setStream}
          renderReasonCode={renderReasonCode}
          handleTransactionStatus={handleTransactionStatus}
          tokenList={tokenList}
          cart={<Cart />}
        />
      </div>

      <div className="status-graph">
        <select
          className="dropdown-select"
          value={chartType}
          onChange={(e) => setChartType(e.target.value as "bar" | "pie")}
        >
          <option value="bar">Bar Chart</option>
          <option value="pie">Pie Chart</option>
        </select>

        <>
          {stream && (
            <StreamStatus
              stream={stream}
              chartType={chartType}
              background="#110036"
              color="#B40C4C"
            />
          )}
        </>
      </div>
      {stream && (
        <>
          <div>
            <CancelStream
              stream={stream}
              reason={reason}
              sm={sm}
              onComplete={handleCancelComplete}
            />
          </div>
          {cancelResult && <p>{cancelResult}</p>}
        </>
      )}
      {stream && (
        <div>
          <UpdateStream
            stream={stream}
            sm={sm}
            token={selectedToken}
            streamDailyCost={BigInt(100 * 86400)}
          />
        </div>
      )}
    </>
  );
}

export default App;
