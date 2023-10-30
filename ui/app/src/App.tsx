import React, { useState, useEffect } from "react";
import { TokenInfo } from "@uniswap/token-lists";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import config from "./config";
// NOTE: Do this or else it won't render (or create your own CSS)
import "rc-slider/assets/index.css";
import "./styles.css";
import CreateStream from "lib/CreateStream";
import StreamStatus from "lib/StreamStatus";
import CancelStream from "lib/CancelStream";
import UpdateStream from "lib/UpdateStream";
import StreamManager, { Stream } from "sdk/js/index";
import {
  usePublicClient,
  useWalletClient,
  WalletClient,
  useAccount,
} from "wagmi";

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

  // Manage results from CreateStream component
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

  // Manage cancel status from CancelStream component
  // Use this callback to close the cancel modal
  const [cancelStatus, setCancelStatus] = useState<boolean>(false);

  // Manage update status from UpdateStream component
  // Use this callback to close the update modal
  const [updateStatus, setUpdateStatus] = useState<boolean>(false);

  // Generate random string (demo app only);
  const renderReasonCode = async () => {
    return Math.random().toString(36).substring(7);
  };

  const publicClient = usePublicClient();
  const walletClient = useWalletClient()?.data;
  const { address } = useAccount();

  const [stream, setStream] = useState<Stream | null>(null);
  const [createdStreams, setCreatedStreams] = useState<Stream[]>([]);

  // Manage callback from onstreamcreate
  const addStream = (newStream: Stream) => {
    setCreatedStreams((prevStreams) => [...prevStreams, newStream]);
  };

  // Fetch the StreamManager and its streams
  useEffect(() => {
    StreamManager.fromAddress(
      config.streamManagerAddress as `0x${string}`,
      publicClient,
      walletClient as WalletClient
    )
      .then((SM) => {
        console.log("fetching all streams");
        SM.fetchAllStreams();
        // SM.onStreamCreated(addStream, address);
      })
      .catch(console.error);
  }, [addStream, address]);

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
        {/* CreateStream transaction callback */}
        {isProcessing && <p>Processing Transaction... </p>}
        {isProcessed && (
          <p>Transaction Successful! -redirect to another page-</p>
        )}
        {processTxError && <p>Tx Error: {processTxError.message}</p>}
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
          amountPerSecond={BigInt(100)}
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

        {createdStreams.length > 0 && (
          <StreamStatus
            stream={createdStreams.slice(-1)[0]}
            chartType={chartType}
            background="#110036"
            color="#B40C4C"
          />
        )}
      </div>
      {createdStreams.length > 0 && (
        <>
          <div>
            <CancelStream
              stream={createdStreams.slice(-1)[0]}
              onComplete={() => setCancelStatus(!cancelStatus)}
            />
          </div>
          {/* CancelStream callback */}
          {cancelStatus && (
            <p className="label-close-modal">
              {" "}
              -Deployment is being cancelled- Close modal
            </p>
          )}
        </>
      )}
      {createdStreams.length > 0 && (
        <>
          <div>
            <UpdateStream
              stream={createdStreams.slice(-1)[0]}
              onComplete={() => setUpdateStatus(!updateStatus)}
            />
          </div>
          {/* UpdateStream callback */}
          {updateStatus && (
            <p className="label-close-modal">
              {" "}
              -Deployment is being updated- Close modal
            </p>
          )}
        </>
      )}
    </>
  );
}

export default App;
