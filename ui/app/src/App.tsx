import React, { useState, useEffect } from "react";
import { TokenInfo } from "@uniswap/token-lists";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import config from "./config";
// NOTE: Do this or else it won't render (or create your own CSS)
import "rc-slider/assets/index.css";
import "./styles.css";
import StreamManager, { Stream } from "@apeworx/apepay";
import {
  CreateStream,
  CancelStream,
  UpdateStream,
  StreamStatus,
} from "@apeworx/apepay-react";
import { Address } from "viem";
import {
  usePublicClient,
  useWalletClient,
  WalletClient,
  useAccount,
} from "wagmi";
import { Link } from "react-router-dom";

function App() {
  // const tokenList: TokenInfo[] = config.tokens;
  const [chartType, setChartType] = useState<"bar" | "pie">("bar");

  // Let user pick the stream he wants to work on for the status, update, and cancel components
  const [selectedStream, setSelectedStream] = useState<Stream | null>(null);

  // // Fake cart for the purpose of the demo
  // const Cart = () => {
  //   return (
  //     <div className="cart">
  //       <div className="cart-item">
  //         <div className="cart-info">
  //           <span className="cart-title">Cart Title</span>
  //           <span className="cart-quantity">#: 1</span>
  //           <span className="price">$XX.00/day</span>
  //         </div>
  //         <div className="cart-details">
  //           <strong>Details:</strong>
  //           <p>Description of the cart that you are about to pay for.</p>
  //         </div>
  //       </div>
  //     </div>
  //   );
  // };

  // Manage results from CreateStream component
  // const [isProcessing, setIsProcessing] = useState<boolean>(false);
  // const [processTxError, setProcessTxError] = useState<Error | null>(null);
  // const [isProcessed, setIsProcessed] = useState<boolean>(false);
  // const handleTransactionStatus = (
  //   processing: boolean,
  //   processed: boolean,
  //   error: Error | null,
  // ) => {
  //   setIsProcessing(processing);
  //   setIsProcessed(processed);
  //   setProcessTxError(error);
  // };

  // Manage cancel status from CancelStream component
  // Use this callback to close the cancel modal
  const [cancelStatus, setCancelStatus] = useState<boolean>(false);

  // Manage update status from UpdateStream component
  // Use this callback to close the update modal
  const [updateStatus, setUpdateStatus] = useState<boolean>(false);

  // Generate random string (demo app only);
  // const renderReasonCode = async () => {
  //   return Math.random().toString(36).substring(7);
  // };

  const publicClient = usePublicClient();
  const walletClient = useWalletClient()?.data as WalletClient;
  const { address } = useAccount();

  const [SM, setSM] = useState<StreamManager | null>(null);
  const [createdStreams, setCreatedStreams] = useState<Stream[]>([]);

  // Append the past streams and the newly created streams to an array
  const addStreams = (stream: Stream) => {
    setCreatedStreams((prevStreams) => {
      // Convert streamId to number to avoid duplicates in array
      stream.streamId = Number(stream.streamId);

      // Check if the stream is already present
      const isExistingStream = prevStreams.some(
        (prevStream) => prevStream.streamId === stream.streamId,
      );

      return isExistingStream ? prevStreams : [...prevStreams, stream];
    });
  };

  // Fetch logs starting from this block
  // TODO: find a way to get the SM deployment block
  const fromBlock = config.fromBlock ? BigInt(config.fromBlock) : undefined;

  // Fetch the StreamManager and all its logs
  // Then reconstruct the streams from it
  // Then set a watcher for new streams
  useEffect(() => {
    // 1. Initialize StreamManager
    if (SM === null && walletClient !== undefined) {
      StreamManager.fromAddress(
        config.streamManagerAddress as `0x${string}`,
        publicClient,
        walletClient,
      )
        .then((SM) => {
          setSM(SM);
          // 2. Fetch all past stream logs
          SM.onAllStreams(addStreams, fromBlock);
          // 4. Initialize watcher for new streams.
          SM.onStreamCreated(addStreams, address);
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

  // Filter streams via creator
  type GroupedStreams = {
    [key in Address]?: Stream[];
  };
  const groupedStreams = createdStreams.reduce<GroupedStreams>(
    (groups, stream) => {
      const creatorKey = stream.creator;

      if (!groups[creatorKey]) {
        groups[creatorKey] = [];
      }

      groups[creatorKey]?.push(stream);
      return groups;
    },
    {},
  );

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
                (stream) => String(stream.streamId) === selectedStreamId,
              );
              setSelectedStream(selected || null);
            }}
          >
            <option value="" disabled hidden>
              Select a stream
            </option>
            {createdStreams
              .slice()
              .sort((a, b) => a.streamId - b.streamId)
              .map((stream) => (
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
                <p> Token: {String(streamInfo.token)}</p>
                <p> Creator: {selectedStream.creator}</p>
                <p> Amount per second: {String(streamInfo.amountPerSecond)}</p>
                <p> Funded amount: {String(streamInfo.fundedAmount)}</p>
                <p>
                  <Link
                    to={`/${selectedStream.creator}/${selectedStream.streamId}`}
                  >
                    Go to Stream {selectedStream.streamId}
                  </Link>{" "}
                </p>
                <p>
                  <Link to={`/${selectedStream.streamManager.address}`}>
                    Go to Stream Manager
                  </Link>
                </p>
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

      <h1>
        {fromBlock != null
          ? `Created Streams from block ${String(fromBlock)}`
          : "Created Streams"}
      </h1>
      {/* Stream list */}
      <div className="list-streams">
        {SM === null ? (
          <p>Fetching SM...</p>
        ) : createdStreams.length === 0 ? (
          <p>
            {fromBlock != null
              ? `Loading streams from block ${String(fromBlock)}...`
              : "Loading all of the created streams"}
          </p>
        ) : (
          <ul>
            {Object.keys(groupedStreams).map((creator) => {
              const creatorKey = creator as Address;

              return (
                <div key={creatorKey}>
                  <h3 className="list-creator">Creator: {creatorKey}</h3>
                  <ul>
                    {groupedStreams[creatorKey]
                      ?.sort((a, b) => Number(a.streamId) - Number(b.streamId))
                      .map((stream, index) => (
                        <li key={index}>
                          <Link
                            to={`/${stream.streamManager.address}/${stream.creator}/${stream.streamId}`}
                          >
                            <p>
                              <strong>Stream ID:</strong>{" "}
                              {Number(stream.streamId)}
                            </p>
                          </Link>
                        </li>
                      ))}
                  </ul>
                </div>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

export default App;
