import React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";

import { Stream } from "@apeworx/apepay";

// import { CreateStream, StreamStatus } from "@apeworx/apepay-react";
import { StreamStatus } from "@apeworx/apepay-react";
import CreateStream from "../../../ui/lib/CreateStream";
// NOTE: Do this or else it won't render (or create your own CSS)
import "rc-slider/assets/index.css";

function App() {
  return (
    <>
      {/* LOG IN WITH WALLET */}
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
          tokenAddress={"0x0579FC0e764E7CC10c7175533B1330B184B8D505"}
          amountPerSecond={100000000000000}
          reasonCode={"1"}
          registerStream={(s: Stream) => console.log(s)}
        />
      </div>
      {/* <ul
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
                useWalletClient()?.data as WalletClient
              )
            }
          />
        </li>
      </ul> */}
    </>
  );
}

export default App;
