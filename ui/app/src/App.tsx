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
      <div className="header header-app">
        <ConnectButton />
      </div>

      <div>
        <p> Stream Manager </p>
        <Link to={`/${config.streamManagerAddress}`}>
          <p> - {config.streamManagerAddress as `0x${string}`} </p>
        </Link>
      </div>
    </>
  );
}

export default App;
