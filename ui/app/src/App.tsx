import React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Link } from "react-router-dom";
import config from "./config";
import "./styles.css";

function App() {
  return (
    <>
      <div className="header header-app">
        <ConnectButton />
      </div>

      <div className="list-stream-managers">
        <h2> Stream Managers </h2>
        <ul>
          <Link to={`/${config.streamManagerAddress}`}>
            <li>
              <h3>{config.streamManagerAddress as `0x${string}`} </h3>
            </li>
          </Link>
        </ul>
      </div>
    </>
  );
}

export default App;
