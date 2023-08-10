import React, { useState, ReactNode } from "react";
import Slider from "rc-slider";
import { Address, WalletClient } from "viem";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useWalletClient,
  usePrepareContractWrite,
  useContractWrite,
} from "wagmi";

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
  const { address } = useAccount();
  const { data: tokenData } = useBalance({
    address,
    token: props.tokenAddress,
  });
  // TODO: handle `isError`, `isLoading`
  const maxTime = Number(
    (tokenData?.value || BigInt(0)) / BigInt(props.amountPerSecond)
  );

  // TODO: Handle if the user has no token balance
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
    sm.create(
      props.tokenAddress,
      props.amountPerSecond,
      props.reasonCode
    ).then(props.registerStream)
  };

  return (
    <div id="CreateStream">
      {/* Display: What is the product they are paying for? With what token? */}
      {props.cart && props.cart}

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
        <button disabled={!approveStream} onClick={() => approveStream?.()}>
          {`Approve ${(
            (selectedTime * props.amountPerSecond) /
            Math.pow(10, tokenData?.decimals || 0)
          ).toFixed(Math.min(tokenData?.decimals || 0, 3))} ${
            tokenData?.symbol
          }`}
        </button>
      </div>
      <br />

      {/* Part 3: The user creates their stream, using the given reason/product code */}
      <div id="CreateStream-create">
        <button onClick={createStream}>
          {`Open Stream for ${selectedTime / SECS_PER_DAY} day${
            selectedTime !== SECS_PER_DAY ? "s" : ""
          }`}
        </button>
      </div>
      <br />
    </div>
  );
};

export default CreateStream;
