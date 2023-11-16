import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import StreamManager, { Stream } from "@apeworx/apepay";
import { Address } from "viem";
import config from "./config";
import { usePublicClient, useWalletClient, WalletClient } from "wagmi";

const StreamManagerPage = () => {
  const { sm } = useParams();
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
          SM.onStreamCreated(addStreams);
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

      return isExistingStream ? prevStreams : [...prevStreams, stream];
    });
  };

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
    <div>
      <div> SM: {sm} </div>
      <h1>
        {fromBlock != null
          ? `Created Streams from block ${String(fromBlock)}`
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
            {Object.keys(groupedStreams).map((creator) => {
              const creatorKey = creator as Address;

              return (
                <div key={creatorKey}>
                  <h3 className="list-creator"> Creator:</h3>

                  <Link to={`/${sm}/${creatorKey}`}>
                    <h3 className="list-creator"> {creatorKey}</h3>
                  </Link>

                  <ul>
                    {groupedStreams[creatorKey]
                      ?.sort((a, b) => Number(a.streamId) - Number(b.streamId))
                      .map((stream, index) => (
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
                </div>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default StreamManagerPage;
