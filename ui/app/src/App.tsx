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
  const [transactionAmount, setTransactionAmount] = useState<number | null>(
    null
  );
  // Set transaction amount to integer
  const intTransactionAmount =
    transactionAmount !== null ? Number(transactionAmount) : null;
  // get user token balance and native token balance
  useEffect(() => {
    if (account && account.address) {
      (async () => {
        const balanceData = await fetchBalance({ address: account.address });
        setBalance(balanceData);
        // get stream token balance
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

  // Get gas fees
  const { data, isError, isLoading } = useFeeData();
  // uncomment to get errors
  // if (isLoading) return <div>Fetching fee data…</div>;
  // if (isError) return <div>Error fetching fee data</div>;
  const formattedGasPrice = data ? data.formatted.gasPrice : "N/A";

  const intGasPrice =
    formattedGasPrice !== undefined ? Number(formattedGasPrice) : null;
  // Max fee using dynamic Gas Price X eth base fee (no EIP-1559 yet)
  const totalMaxFee = intGasPrice * 21000;

  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (intGasPrice !== null && intBalance !== null) {
      console.log("Checking native token");
      if (intGasPrice < intBalance) {
        console.log("Native token check passed");
        if (intTransactionAmount !== null && intTokenBalance !== null) {
          console.log("Checking stream token");
          if (intTransactionAmount < intTokenBalance) {
            console.log("Stream token check passed");
            setShowModal(true);
          } else {
            console.log("Stream token check failed");
          }
        } else {
          console.log("Waiting for stream token check");
        }
      } else {
        console.log("Native token check failed");
      }
    } else {
      console.log("Waiting for native token check");
    }
  }, [intGasPrice, intBalance, intTransactionAmount, intTokenBalance]);

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

      {/* gas price and estimated fee */}
      <div>
        {formattedGasPrice !== "N/A" ? (
          <div>gas price: {formattedGasPrice}</div>
        ) : (
          <div>No gas price fetched</div>
        )}
        Estimated fee: {totalMaxFee}
      </div>

      {/* TOKEN BALANCES */}
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

      {/* TRANSACTION AMOUNT */}
      <div>Transaction Amount: {intTransactionAmount}</div>
      <div>
        {intGasPrice !== null && intBalance !== null ? (
          intGasPrice < intBalance ? (
            <div>
              {intTransactionAmount !== null && intTokenBalance !== null ? (
                intTransactionAmount < intTokenBalance ? (
                  <p>
                    Stream tokens and native tokens balance OK. Show the modal.
                  </p>
                ) : (
                  <p>Not enough stream tokens. Redirecting to Uniswap.</p>
                )
              ) : (
                <p>(step 2) Checking stream token balance...</p>
              )}
            </div>
          ) : (
            <p>
              Not enough native tokens to pay for fees. Redirecting to Hop
              exchange.
            </p>
          )
        ) : (
          <p>(step 1) Checking gas and native token balance...</p>
        )}
      </div>

      <div
        style={{
          display: showModal ? "flex" : "none",
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
