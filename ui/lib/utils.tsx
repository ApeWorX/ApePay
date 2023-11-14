import { useState, useEffect } from "react";
import { TokenInfo } from "@uniswap/token-lists";

// Display stream time with the correct units
export function formatTime(seconds: number) {
  seconds = Math.floor(seconds);
  if (seconds < 60) {
    return ` ${seconds} second${seconds !== 1 ? "s" : ""}`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainderSeconds = Math.floor(seconds % 60);
    return ` ${minutes} minute${
      minutes !== 1 ? "s" : ""
    } and ${remainderSeconds} second${remainderSeconds !== 1 ? "s" : ""}`;
  } else if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const remainderMinutes = Math.floor((seconds % 3600) / 60);
    return ` ${hours} hour${
      hours !== 1 ? "s" : ""
    } and ${remainderMinutes} minute${remainderMinutes !== 1 ? "s" : ""}`;
  } else {
    const days = Math.floor(seconds / 86400);
    const remainderHours = Math.floor((seconds % 86400) / 3600);
    return ` ${days} day${days !== 1 ? "s" : ""} and ${remainderHours} hour${
      remainderHours !== 1 ? "s" : ""
    }`;
  }
}

// Fetch current time in seconds
export const useCurrentTime = () => {
  const [currentTime, setCurrentTime] = useState<number>(Date.now() / 1000);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now() / 1000);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return currentTime;
};

export const roundTxDecimals = (
  number: number,
  selectedToken: TokenInfo | null,
): number | null => {
  if (!selectedToken?.decimals) {
    return number;
  }

  const divisor = BigInt(10 ** selectedToken.decimals);
  const roundedNumber = BigInt(number) / divisor + 1n;

  // Convert back to the original scale and return as a floating-point number
  return parseFloat(
    (Number(roundedNumber) * 10 ** selectedToken.decimals).toString(),
  );
};
