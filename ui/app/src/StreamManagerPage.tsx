import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Address } from "viem";
import { usePublicClient, useWalletClient, WalletClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import StreamManager, { Stream } from "@apeworx/apepay";
import config from "./config";
import Header from "./Header";
import { Button } from "evergreen-ui";
import { useTheme } from "./ThemeContext";

const StreamManagerPage = () => {
  const { theme } = useTheme();
  const { sm } = useParams();
  const [createdStreams, setCreatedStreams] = useState<Stream[]>([]);
  const [streamManager, setStreamManager] = useState<StreamManager | null>(
    null,
  );

  const publicClient = usePublicClient();
  const walletClient = useWalletClient()?.data as WalletClient;

  // Fetch logs starting from this block
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
    <div className={`app ${theme}`}>
      <div className="header">
        <Header />
        <ConnectButton />
      </div>

      <div>
        <div className="stream-manager-title">
          {fromBlock != null ? (
            <>
              {"Created Streams from block "}
              <strong>{String(fromBlock)}</strong>
              <br />
              {"on "}
              <strong>{sm}</strong>
            </>
          ) : (
            <>
              {"Created Streams on "}
              <strong>{sm}</strong>
            </>
          )}
        </div>

        <div className="create-stream-sm-text">
          <Link to={`/${sm}/create`}>
            <Button appearance="primary" intent="success" height={40}>
              Create a Stream
            </Button>
          </Link>
        </div>

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
                  <div key={creator}>
                    <h3 className="list-creator">
                      By <Link to={`/${sm}/${creator}`}>{creator}</Link>:
                    </h3>

                    <ul className="list-streams">
                      {groupedStreams[creatorKey]
                        ?.sort(
                          (a, b) => Number(a.streamId) - Number(b.streamId),
                        )
                        .map((stream, index) => (
                          <li key={index}>
                            <Link
                              to={`/${stream.streamManager.address}/${stream.creator}/${stream.streamId}`}
                            >
                              ID: {stream.streamId}
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
    </div>
  );
};

export default StreamManagerPage;
