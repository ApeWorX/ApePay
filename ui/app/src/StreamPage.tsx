import React, { useState, useEffect } from "react";
import config from "./config";
// NOTE: Do this or else it won't render (or create your own CSS)
import "rc-slider/assets/index.css";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import "./styles.css";
import StreamManager, { Stream } from "@apeworx/apepay";
import {
  CancelStream,
  UpdateStream,
  StreamStatus,
} from "@apeworx/apepay-react";
import {
  usePublicClient,
  useWalletClient,
  WalletClient,
  useAccount,
} from "wagmi";
import { useParams } from "react-router-dom";
import BackButton from "./BackButton";

const StreamPage = () => {
  const { sm, creator, streamId } = useParams();

  const [chartType, setChartType] = useState<"bar" | "pie">("bar");

  const publicClient = usePublicClient();
  const walletClient = useWalletClient()?.data as WalletClient;
  const { address } = useAccount();

  const [SM, setSM] = useState<StreamManager | null>(null);
  const [stream, setStream] = useState<Stream | null>(null);

  // Manage cancel status from CancelStream component
  // Use this callback to close the cancel modal
  const [cancelStatus, setCancelStatus] = useState<boolean>(false);

  // Manage update status from UpdateStream component
  // Use this callback to close the update modal
  const [updateStatus, setUpdateStatus] = useState<boolean>(false);

  // Append the past streams and the newly created streams to an array
  const addStreams = (stream: Stream) => {
    // Convert streamId to number to avoid duplicates in array
    stream.streamId = Number(stream.streamId);

    // Check if the stream is already present
    const isCorrectCreator = stream.creator === creator;

    // If the stream is not existing, then check the creator
    if (isCorrectCreator) {
      // Check if the creator is the correct one
      const isCorrectID = stream.streamId === Number(streamId);

      // Add stream if the creator matches
      if (isCorrectID) {
        setStream(stream);
      }
    }
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
      StreamManager.fromAddress(sm as `0x${string}`, publicClient, walletClient)
        .then((SM) => {
          setSM(SM);
          // 2. Fetch all past stream logs
          SM.onAllStreams(addStreams, fromBlock);
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

  // Get info about your stream
  useEffect(() => {
    if (stream) {
      stream
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
  }, [stream]);

  return (
    <div>
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
      <h1>Stream {streamId} Details</h1>
      {stream && (
        <>
          {/* Stream Data */}
          <div className="stream-data">
            <div> SM: {sm} </div>
            <p> Token: {String(streamInfo.token)}</p>
            <p> Creator: {creator}</p>
            <p> Amount per second: {String(streamInfo.amountPerSecond)}</p>
            <p> Funded amount: {String(streamInfo.fundedAmount)}</p>
          </div>

          {/* Stream Status */}
          <h3> Stream Status</h3>
          <div className="status-graph">
            <select
              className="dropdown-select"
              value={chartType}
              onChange={(e) => setChartType(e.target.value as "bar" | "pie")}
            >
              <option value="bar">Bar Chart</option>
              <option value="pie">Pie Chart</option>
            </select>
            <div className="stream-status-component">
              <StreamStatus
                stream={stream}
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
              stream={stream}
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
              stream={stream}
              onComplete={() => setUpdateStatus(!updateStatus)}
            />
          </div>

          {/* UpdateStream callback */}
          {updateStatus && (
            <p className="label-close-modal">
              -Deployment is being updated- Close modal
            </p>
          )}
          <BackButton />
        </>
      )}
    </div>
  );
};

export default StreamPage;