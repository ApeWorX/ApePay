import "./polyfills";
import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultWallets, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { configureChains, createConfig, WagmiConfig } from "wagmi";
import { polygon, optimism, arbitrum, sepolia } from "wagmi/chains";
import { publicProvider } from "wagmi/providers/public";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import StreamManagerPage from "./StreamManagerPage";
import CreatePage from "./CreatePage";
import CreatorPage from "./CreatorPage";
import StreamPage from "./StreamPage";

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

const { chains, publicClient } = configureChains(
  // NOTE: Testnet deployment on Sepolia
  [
    arbitrum,
    optimism,
    polygon,
    {
      ...sepolia,
      rpcUrls: {
        ...sepolia.rpcUrls,
        // The default Sepolia ndoes are pretty overwhelmed
        default: {
          http: ["https://gateway.tenderly.co/public/sepolia"],
        },
        public: {
          http: ["https://gateway.tenderly.co/public/sepolia"],
        },
      },
    },
  ],
  [publicProvider()],
);

const { connectors } = getDefaultWallets({
  appName: "ApePay Dashboard",
  projectId: "YOUR_PROJECT_ID",
  chains,
});

const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiConfig config={wagmiConfig}>
      <RainbowKitProvider chains={chains}>
        <Router>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path=":sm" element={<StreamManagerPage />} />
            <Route path=":sm/create" element={<CreatePage />} />
            <Route path=":sm/:creator" element={<CreatorPage />} />
            <Route path=":sm/:creator/:streamId" element={<StreamPage />} />
          </Routes>
        </Router>
      </RainbowKitProvider>
    </WagmiConfig>
  </React.StrictMode>,
);
