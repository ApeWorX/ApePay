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
  const walletClient = useWalletClient()?.data as WalletClient;
  const { address } = useAccount();

  const [stream, setStream] = useState<Stream | null>(null);
  const [createdStreams, setCreatedStreams] = useState<Stream[]>([]);

  console.log(createdStreams);

  // Append the past streams and the newly created streams to an array
  const addStreams = (streams: Stream | Stream[]) => {
    setCreatedStreams((prevStreams) => {
      const newStreams = Array.isArray(streams) ? streams : [streams];
      const uniqueNewStreams = newStreams.filter(
        (newStream) =>
          !prevStreams.some(
            (prevStream) => prevStream.streamId === newStream.streamId
          )
      );
      return [...prevStreams, ...uniqueNewStreams];
    });
  };

  // Fetch the StreamManager and all its logs
  // Then reconstruct the streams from it
  // Then set a watcher for new streams
  useEffect(() => {
    // 1. Initialize StreamManager
    StreamManager.fromAddress(
      config.streamManagerAddress as `0x${string}`,
      publicClient,
      walletClient,
    )
      .then((SM) => {
        console.log("SM initialized");
        // 2. Fetch all past stream logs
        SM.fetchAllLogs(async (allLogs) => {
          console.log("Fetching all logs");
          try {
            // 3. Convert logs to Stream objects
            const PastStreams = await Promise.all(
              allLogs.map((log) =>
                Stream.fromEventLog(
                  SM,
                  log,
                  publicClient,
                  walletClient,
                )
              )
            );
            addStreams(PastStreams);
            // 4. Initialize watcher for new streams.
            console.log("Watcher initialized");
            SM.onStreamCreated(addStreams, address);
          } catch (err) {
            console.log("Error processing streams", err);
          }
        });
      })
      .catch(console.error);
  }, [addStreams, address]);

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

      {/* Display list of past streams */}
      <div className="list-streams">
        <h1>Created Streams</h1>
        {createdStreams.length === 0 ? (
          <p>Loading past streams...</p>
        ) : (
          <ul>
            {createdStreams.map((stream, index) => (
              <li key={index}>
                <p>
                  <strong>Stream ID:</strong> {Number(stream.streamId)}
                  {/* {Number(stream.streamId)} */}
                </p>
                <p>
                  <strong>Creator:</strong> {stream.creator}
                </p>
                <hr />
              </li>
            ))}
          </ul>
        )}
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
