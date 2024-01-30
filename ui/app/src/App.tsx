import React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Link } from "react-router-dom";
import config from "./config";
import "./styles.css";
import "./sakura.css";
import "./tokyoNight.css";
import "./nord.css";
import { useTheme } from "./ThemeContext";
import Header from "./Header";

function App() {
  const { theme } = useTheme();

  return (
    <>
      <div className={`app ${theme}`}>
        <div className="header">
          <Header showNavButtons={false} />
          <ConnectButton />
        </div>

        <div className="list-stream-managers">
          <h2> Stream Managers </h2>
          <ul>
            <Link to={`/${config.streamManagerAddress}`}>
              <li>
                <h3 className="stream-data-subtitle">
                  {config.streamManagerAddress as `0x${string}`}
                </h3>
              </li>
            </Link>
          </ul>
        </div>
      </div>
    </>
  );
}

export default App;
