import React from "react";
import { usePublicClient, useWalletClient, WalletClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

import { Stream } from "@apeworx/apepay";
import { CreateStream, StreamStatus } from "@apeworx/apepay-react";
// NOTE: Do this or else it won't render (or create your own CSS)
import "rc-slider/assets/index.css";

function App() {
  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          padding: 12,
        }}
      >
        <ConnectButton />
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
          streamManagerAddress={"0xb5ED1eF2a90527b402Cd7e7d415027CB94E1Db4E"}
          tokenAddress={"0xbc083D97825DA7f7182F37fcEc51818E196aF1FF"}
          amountPerSecond={100000000000000}
          reasonCode={"1"}
          registerStream={(s: Stream) => console.log(s)}
        />
      </div>
      <ul
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "20vh",
        }}
      >
        <li>
          <StreamStatus
            stream={
              new Stream(
                "0xb5ED1eF2a90527b402Cd7e7d415027CB94E1Db4E",
                "0x1C277bD41A276F87D3E92bccD50c7364aa2FFc69",
                3,
                usePublicClient(),
                useWalletClient()?.data as WalletClient,
              )
            }
          />
        </li>
      </ul>
    </>
  );
}

export default App;
