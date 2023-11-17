import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import StreamManager, { Stream } from "@apeworx/apepay";
import config from "./config";
import { usePublicClient, useWalletClient, WalletClient } from "wagmi";
import BackButton from "./BackButton";
import { ConnectButton } from "@rainbow-me/rainbowkit";


const CreatorPage = () => {
  const { sm, creator } = useParams();
  const [createdStreams, setCreatedStreams] = useState<Stream[]>([]);
  const [streamManager, setStreamManager] = useState<StreamManager | null>(
    null,
  );

  const publicClient = usePublicClient();
  const walletClient = useWalletClient()?.data as WalletClient;

  // Fetch logs starting from this block
  // TODO: let user input dynamically a block
  const fromBlock = config.fromBlock ? BigInt(config.fromBlock) : undefined;

  // Fetch the StreamManager and all its logs
  // Then reconstruct the streams from it
  // Then set a watcher for new streams
  useEffect(() => {
    // 1. Initialize StreamManager
    if (streamManager === null && walletClient !== undefined) {
      StreamManager.fromAddress(sm as `0x${string}`, publicClient, walletClient)
        .then((SM) => {
          setStreamManager(SM);
          // 2. Fetch all past stream logs
          SM.onAllStreams(addStreams, fromBlock);
          // 4. Initialize watcher for new streams.
          SM.onStreamCreated(addStreams, creator as `0x${string}`);
        })
        .catch(console.error);
    }
  }, [streamManager, walletClient]);

  // Append the past streams and the newly created streams to an array
  const addStreams = (stream: Stream) => {
    setCreatedStreams((prevStreams) => {
      // Convert streamId to number to avoid duplicates in array
      stream.streamId = Number(stream.streamId);

      // Check if the stream is already present
      const isExistingStream = prevStreams.some(
        (prevStream) => prevStream.streamId === stream.streamId,
      );

      // If the stream is not existing, then check the creator
      if (!isExistingStream) {
        // Check if the creator is the correct one
        const isCorrectCreator = stream.creator === creator;

        // Add stream if the creator matches
        if (isCorrectCreator) {
          return [...prevStreams, stream];
        }
      }

      // Return previous streams if conditions not met
      return prevStreams;
    });
  };

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
      <h1>
        {fromBlock != null
          ? `Created Streams from block ${String(fromBlock)} from ${creator}`
          : "Created Streams"}
      </h1>
      {/* Stream list */}
      <div className="list-streams">
        {sm === null ? (
          <p>Fetching SM...</p>
        ) : createdStreams.length === 0 ? (
          <p>
            {fromBlock != null
              ? `Loading streams from block ${String(fromBlock)}...`
              : "Loading all of the created streams"}
          </p>
        ) : (
          <ul>
            {createdStreams.map((stream, index) => (
              <li key={index}>
                <Link
                  to={`/${stream.streamManager.address}/${stream.creator}/${stream.streamId}`}
                >
                  <p>
                    <strong>Stream ID:</strong> {stream.streamId}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <BackButton />
    </>
  );
};

export default CreatorPage;
