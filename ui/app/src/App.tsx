import React, { useState, useEffect } from "react";
import {
  usePublicClient,
  useWalletClient,
  WalletClient,
  useAccount,
  useFeeData,
} from "wagmi";
import { fetchBalance } from "@wagmi/core";
import { ConnectButton } from "@rainbow-me/rainbowkit";

import { Stream } from "@apeworx/apepay";
// import { CreateStream, StreamStatus } from "@apeworx/apepay-react";
import CreateStream from "../../../ui/lib/CreateStream";

// NOTE: Do this or else it won't render (or create your own CSS)
import "rc-slider/assets/index.css";

function App() {
  const [balance, setBalance] = useState(null);
  const [tokenBalance, setTokenBalance] = useState(null);
  const account = useAccount();

  // Set transaction amount
  const [transactionAmount, setTransactionAmount] = useState<number | null>(
    null
  );
  const intTransactionAmount =
    transactionAmount !== null ? Number(transactionAmount) : null;

  // get user token balance and native token balance
  useEffect(() => {
    if (account && account.address) {
      (async () => {
        const balanceData = await fetchBalance({ address: account.address });
        setBalance(balanceData);

        const tokenBalanceData = await fetchBalance({
          address: account.address,
          token: "0x0579FC0e764E7CC10c7175533B1330B184B8D505",
        });
        setTokenBalance(tokenBalanceData);
      })();
    }
  }, [account]);

  // convert stream token balance to int
  const intTokenBalance =
    tokenBalance && tokenBalance.formatted !== undefined
      ? Number(tokenBalance.formatted)
      : null;

  // convert native token balance to int
  const intBalance =
    balance && balance.formatted !== undefined
      ? Number(balance.formatted)
      : null;

  const { data, isError, isLoading } = useFeeData();
  // uncomment to get errors
  // if (isLoading) return <div>Fetching fee data…</div>;
  // if (isError) return <div>Error fetching fee data</div>;
  const formattedGasPrice = data ? data.formatted.gasPrice : "N/A";

  const intGasPrice =
    formattedGasPrice !== undefined ? Number(formattedGasPrice) : null;

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
      <div>Transaction Amount: {intTransactionAmount}</div>
      <div>
        {balance && (
          <p>
            User native token balance: {intBalance} {balance.symbol}
          </p>
        )}
        {tokenBalance && (
          <p>
            User stream token balance: {intTokenBalance}
            {tokenBalance.symbol}
          </p>
        )}
      </div>
      <div>
        {intTransactionAmount !== null && intTokenBalance !== null ? (
          intTransactionAmount < intTokenBalance ? (
            <p> = token balance enough to cover stream price </p>
          ) : (
            <p> Redirect to uniswap</p>
          )
        ) : (
          <p>Waiting for transaction and balance data...</p>
        )}
      </div>
      <div>
        {formattedGasPrice !== "N/A" ? (
          <div>Gas Price: {formattedGasPrice}</div>
        ) : (
          <div>No gas price fetched</div>
        )}
      </div>{" "}
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
          setTransactionAmount={setTransactionAmount}
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
