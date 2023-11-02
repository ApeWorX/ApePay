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

  // Let user pick the stream he wants to work on for the status, update, and cancel components
  const [selectedStream, setSelectedStream] = useState<Stream | null>(null);

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

  const [SM, setSM] = useState<StreamManager | null>(null);
  const [createdStreams, setCreatedStreams] = useState<Stream[]>([]);

  // Append the past streams and the newly created streams to an array
  const addStreams = (streams: Stream | Stream[]) => {
    setCreatedStreams((prevStreams) => {
      const newStreams = Array.isArray(streams) ? streams : [streams];

      // Convert streamIds to numbers to avoid duplicates in array
      newStreams.forEach(
        (stream) => (stream.streamId = Number(stream.streamId))
      );

      const uniqueNewStreams = newStreams.filter(
        (newStream) =>
          !prevStreams.some(
            (prevStream) => prevStream.streamId === newStream.streamId
          )
      );
      return [...prevStreams, ...uniqueNewStreams];
    });
  };

  // Fetch logs starting from this block
  // TODO: find a way to get the SM deployment block
  const fromBlock = 4615000n;

  // Fetch the StreamManager and all its logs
  // Then reconstruct the streams from it
  // Then set a watcher for new streams
  useEffect(() => {
    // 1. Initialize StreamManager
    if (SM === null && walletClient !== undefined) {
      StreamManager.fromAddress(
        config.streamManagerAddress as `0x${string}`,
        publicClient,
        walletClient
      )
        .then((SM) => {
          setSM(SM);
          // 2. Fetch all past stream logs
          SM.fetchAllLogs((allLogs) => {
            // 3. Convert logs to Stream objects
            Promise.all(
              allLogs.map((log) =>
                Stream.fromEventLog(SM, log, publicClient, walletClient)
              )
            )
              .then((PastStreams) => {
                addStreams(PastStreams);
                // 4. Initialize watcher for new streams.
                SM.onStreamCreated(addStreams, address);
              })
              .catch((err) => {
                console.log("Error processing streams", err);
              });
          }, fromBlock);
        })
        .catch(console.error);
    }
  }, [SM, address, walletClient]);

  const [streamInfo, setStreamInfo] = useState({
    amountPerSecond: null as bigint | null,
    fundedAmount: null as bigint | null,
    lastPull: null as bigint | null,
    maxStreamLife: null as bigint | null,
    reason: null as Uint8Array | null,
    startTime: null as bigint | null,
    token: null as string | null,
  });

  // Get info about your selected stream
  useEffect(() => {
    if (selectedStream) {
      selectedStream
        .streamInfo()
        .then((info) => {
          setStreamInfo({
            amountPerSecond: info.amount_per_second,
            fundedAmount: info.funded_amount,
            lastPull: info.last_pull,
            maxStreamLife: info.max_stream_life,
            reason: info.reason,
            startTime: info.start_time,
            token: info.token,
          });
        })
        .catch((error) => {
          console.error("Error fetching stream info:", error);
        });
    }
  }, [selectedStream]);

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

      <h1>Created Streams from block {String(fromBlock)}</h1>
      {/* Stream list */}
      <div className="list-streams">
        {SM === null ? (
          <p>Fetching SM...</p>
        ) : createdStreams.length === 0 ? (
          <p>Loading streams from block {String(fromBlock)}...</p>
        ) : (
          <ul>
            {createdStreams
              .sort((a, b) => Number(a.streamId) - Number(b.streamId))
              .map((stream, index) => (
                <ul key={index}>
                  <p>
                    <strong>Stream ID:</strong> {Number(stream.streamId)}
                  </p>
                  <p>
                    <strong>Creator:</strong> {stream.creator}
                  </p>
                  <hr />
                </ul>
              ))}
          </ul>
        )}
      </div>

      {/* Edit specific stream */}
      <h1> Work on a specific stream</h1>
      {createdStreams.length > 0 && (
        <div className="selected-stream-components">
          {/* Select Stream */}
          <h3> Pick a stream to work on</h3>
          <select
            className="dropdown-streamselected"
            value={selectedStream ? selectedStream.streamId : ""}
            onChange={(e) => {
              const selectedStreamId = e.target.value;
              const selected = createdStreams.find(
                (stream) => String(stream.streamId) === selectedStreamId
              );
              setSelectedStream(selected || null);
            }}
          >
            <option value="" disabled hidden>
              Select a stream
            </option>
            {createdStreams.map((stream) => (
              <option key={stream.streamId} value={stream.streamId}>
                {stream.streamId}
              </option>
            ))}
          </select>

          {selectedStream && (
            <>
              {/* Stream Data */}
              <div className="stream-data">
                <h3> Data for stream {selectedStream.streamId}</h3>
                <p> Amount per second: {String(streamInfo.amountPerSecond)}</p>
                <p> Funded amount: {String(streamInfo.fundedAmount)}</p>
                <p> Token: {String(streamInfo.token)}</p>
              </div>

              {/* Stream Status */}
              <h3> Stream Status</h3>
              <div className="status-graph">
                <select
                  className="dropdown-select"
                  value={chartType}
                  onChange={(e) =>
                    setChartType(e.target.value as "bar" | "pie")
                  }
                >
                  <option value="bar">Bar Chart</option>
                  <option value="pie">Pie Chart</option>
                </select>
                <div className="stream-status-component">
                  <StreamStatus
                    key={selectedStream ? selectedStream.streamId : "no-stream"}
                    stream={selectedStream}
                    chartType={chartType}
                    background="#110036"
                    color="#B40C4C"
                  />
                </div>
              </div>

              {/* Cancel Stream */}
              <h3> Cancel Stream</h3>
              <div>
                <CancelStream
                  key={selectedStream ? selectedStream.streamId : "no-stream"}
                  stream={selectedStream}
                  onComplete={() => setCancelStatus(!cancelStatus)}
                />
              </div>

              {/* CancelStream callback */}
              {cancelStatus && (
                <p className="label-close-modal">
                  -Deployment is being cancelled- Close modal
                </p>
              )}

              {/* Update Stream */}
              <h3> Update Stream</h3>
              <div>
                <UpdateStream
                  key={selectedStream ? selectedStream.streamId : "no-stream"}
                  stream={selectedStream}
                  onComplete={() => setUpdateStatus(!updateStatus)}
                />
              </div>

              {/* UpdateStream callback */}
              {updateStatus && (
                <p className="label-close-modal">
                  -Deployment is being updated- Close modal
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Create a stream */}
      <h1> Create a stream</h1>
      <div className="create-stream-component">
        <CreateStream
          streamManagerAddress={config.streamManagerAddress as `0x${string}`}
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
    </>
  );
}

export default App;
