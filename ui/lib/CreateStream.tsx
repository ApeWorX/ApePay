import { useState, useEffect, ReactNode } from "react";
import Slider from "rc-slider";
import { Address, WalletClient } from "viem";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useWalletClient,
  usePrepareContractWrite,
  useContractWrite,
  useFeeData,
} from "wagmi";
import { fetchBalance } from "@wagmi/core";
import StreamManager, { Stream } from "@apeworx/apepay";

const SECS_PER_DAY = 24 * 60 * 60;

export interface CreateStreamProps {
  streamManagerAddress: Address;
  // TODO: Support dynamically fetching list of accepted tokens in sdk::StreamManager
  tokenAddress: Address;
  amountPerSecond: number;
  reasonCode: string;
  cart?: ReactNode;
  registerStream: (stream: Stream) => void;
}

const CreateStream = (props: CreateStreamProps) => {
  const [balance, setBalance] = useState(null);
  const [tokenBalance, setTokenBalance] = useState(null);
  const [gasPrice, setGasPrice] = useState(null);
  const { data, isError, isLoading } = useFeeData();
  const { address } = useAccount();

  // Set balances for native and stream tokens
  useEffect(() => {
    if (address) {
      (async () => {
        // Fetch and set native balance as integer
        const balanceData = await fetchBalance({ address });
        if (balanceData && balanceData.formatted !== undefined) {
          setBalance(Number(balanceData.formatted));
        }
        // Fetch and set token balance as integer
        const tokenBalanceData = await fetchBalance({
          address,
          token: props.tokenAddress,
        });
        if (tokenBalanceData && tokenBalanceData.formatted !== undefined) {
          setTokenBalance(Number(tokenBalanceData.formatted));
        }
      })();
    }
  }, [address]);

  // Get gas price
  useEffect(() => {
    if (data && data.formatted && data.formatted.gasPrice !== undefined) {
      setGasPrice(Number(data.formatted.gasPrice));
    } else {
      setGasPrice(null);
    }
  }, [data, isError, isLoading]);

  const { data: tokenData } = useBalance({
    address,
    token: props.tokenAddress,
  });

  // TODO: handle `isError`, `isLoading`
  const maxTime = Number(
    (tokenData?.value || BigInt(0)) / BigInt(props.amountPerSecond)
  );

  // TODO: Increase stability of deployments beyond a week
  const maxTimeDays: number = Math.min(Math.floor(maxTime / SECS_PER_DAY), 7); // Up to a week
  const marks = Object.fromEntries(
    Array.from(Array(maxTimeDays).keys()).map((v: number) => [
      v + 1,
      `${v + 1}`,
    ])
  );
  const [selectedTime, setSelectedTime] = useState(SECS_PER_DAY); // Defaults 1 day

  const sm = new StreamManager(
    props.streamManagerAddress,
    // TODO: handle `isError`, `isLoading`
    usePublicClient(),
    useWalletClient()?.data as WalletClient
  );

  const { config: approvalConfig } = usePrepareContractWrite({
    address: props.tokenAddress,
    value: BigInt(0),
    abi: [
      {
        name: "approve",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
          { name: "spender", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "success", type: "bool" }],
      },
    ],
    functionName: "approve",
    args: [sm.address, selectedTime * props.amountPerSecond],
  });
  const { write: approveStream } = useContractWrite(approvalConfig);
  const createStream = () => {
    // NOTE: This function should move away from this component
    sm.create(props.tokenAddress, props.amountPerSecond, props.reasonCode).then(
      props.registerStream
    );
  };

  // Set transaction amount
  const transactionAmount = Number(
    (
      (selectedTime * props.amountPerSecond) /
      Math.pow(10, tokenData?.decimals || 0)
    ).toFixed(Math.min(tokenData?.decimals || 0, 3))
  );

  // Open stream button only if Approve button has been clicked
  const [isApproved, setIsApproved] = useState(false);
  const onApproveClick = () => {
    approveStream?.();
    setIsApproved(true);
  };

  const renderBalanceCheck = () => {
    // Step 1: Check gas and native token balance
    if (gasPrice === null || balance === null) {
      return (
        <div id="CreateStream">
          <p>(Step 1/2) Checking gas and native token balance...</p>
        </div>
      );
    }

    // Step 2: Check if there are enough native tokens for fees
    if (gasPrice >= balance) {
      return (
        <div id="CreateStream">
          <p> Not enough native tokens to pay for transaction fees</p>
          <button
            onClick={() => (window.location.href = "https://hop.exchange/")}
          >
            Go to Hop Exchange
          </button>
        </div>
      );
    }

    // Step 3: Check stream token balance
    if (transactionAmount === null || tokenBalance === null) {
      return (
        <div id="CreateStream">
          <p>(Step 2/2) Checking stream token balance...</p>
        </div>
      );
    }

    // Step 4: Check if the user has enough stream tokens
    if (transactionAmount >= tokenBalance) {
      return (
        <div id="CreateStream">
          <p> Not enough tokens to pay for stream</p>
          <button onclick="window.location.href='https://app.uniswap.org/'">
            Go to Uniswap
          </button>
        </div>
      );
    }

    // Step 5: If all checks pass, show the modal
    return (
      <div id="CreateStream">
        <div>
          {/* Display: What is the product they are paying for? With what token? */}
          {/* @ts-ignore */}
          {props.cart && props.cart}
        </div>
        {/* Part 1: The user needs to decide how long they want the stream to run for  */}
        <div id="CreateStream-lifetime">
          <Slider
            min={1}
            marks={marks}
            max={maxTimeDays}
            step={null}
            value={Math.min(selectedTime / SECS_PER_DAY, maxTimeDays)}
            defaultValue={1}
            onChange={(value) =>
              typeof value === "number" && setSelectedTime(SECS_PER_DAY * value)
            }
          />
        </div>
        <br />
        {/* Part 2: The user approves exactly X tokens, corresponding to stream life   */}
        <div id="CreateStream-approve">
          <button disabled={!approveStream} onClick={onApproveClick}>
            {`Approve ${transactionAmount} ${tokenData?.symbol}`}
          </button>
        </div>
        <br />
        {/* Part 3: The user creates their stream, using the given reason/product code */}
        <div id="CreateStream-create">
          <button disabled={!isApproved} onClick={createStream}>
            {`Open Stream for ${selectedTime / SECS_PER_DAY} day${
              selectedTime !== SECS_PER_DAY ? "s" : ""
            }`}
          </button>
        </div>
        <br />
      </div>
    );
  };

  return <div>{renderBalanceCheck()}</div>;
};

export default CreateStream;
