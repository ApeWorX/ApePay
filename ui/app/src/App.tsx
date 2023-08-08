import React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";

import { CreateStream } from "@apeworx/apepay-react";
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
          height: "90vh",
        }}
      >
        <CreateStream
          streamManagerAddress={"0xb5ED1eF2a90527b402Cd7e7d415027CB94E1Db4E"}
          tokenAddress={"0xbc083D97825DA7f7182F37fcEc51818E196aF1FF"}
          amountPerSecond={100000000000000}
          reasonCode={"1"}
          registerStream={(s) => console.log(s)}
        />
      </div>
    </>
  );
}

export default App;
