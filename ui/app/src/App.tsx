import React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Link } from "react-router-dom";
import config from "./config";
import "./styles.css";
import "./sakura.css";
import "./tokyoNight.css";
import { useTheme } from "./ThemeContext";
import { Button, SelectMenu } from "evergreen-ui";

function App() {
  const { theme, setTheme } = useTheme();
  const themes = ["sakura", "tokyoNight", "nord"]; // All your themes

  return (
    <>
      <div className={`app ${theme}`}>
        <div className="header header-app">
          <ConnectButton />
        </div>
        <SelectMenu
          title="Select Theme"
          options={themes.map((t) => ({ label: t, value: t }))}
          selected={theme}
          onSelect={(item) => setTheme(String(item.value))}
        >
          <Button className="theme-toggle-button">{theme}</Button>
        </SelectMenu>

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
      </div>
    </>
  );
}

export default App;
