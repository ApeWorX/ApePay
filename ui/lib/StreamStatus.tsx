import React, { useState, useEffect } from "react";
import { PieChart } from "react-minimal-pie-chart";
import { Stream } from "@apeworx/apepay";

export interface StreamStatusProps {
  stream: Stream;
  chartType: "bar" | "pie";
}

const StreamStatus: React.FC<StreamStatusProps> = ({ stream, chartType }) => {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [totalTime, setTotalTime] = useState<number | null>(null);

  useEffect(() => {
    stream.timeLeft().then(setTimeLeft).catch(console.error);
    stream.totalTime().then(setTotalTime).catch(console.error);

    // Skip the interval if timeLeft is null
    if (timeLeft !== null) {
      const intervalId = setInterval(() => {
        setTimeLeft((prevTimeLeft) =>
          prevTimeLeft !== null ? Math.max(prevTimeLeft - 1, 0) : null
        );
      }, 1000);

      // Clear the interval when the component is unmounted
      return () => clearInterval(intervalId);
    }
  }, [stream]);

  const percentageLeft =
    timeLeft && totalTime ? (timeLeft / totalTime) * 100 : 0;

  return (
    <>
      {timeLeft === null || totalTime === null ? (
        // Loading State
        chartType === "pie" ? (
          <PieChart
            data={[{ value: 1, color: "#ddd" }]}
            totalValue={1}
            lineWidth={20}
            background="#eee"
            label={() => "Loading..."}
            labelPosition={0}
          />
        ) : (
          // Loading state for bar chart
          <div className="stream-status-bar-container">
            <div
              className="stream-status-bar-progress"
              style={{
                backgroundColor: "#ddd",
                width: "100%",
              }}
            />
            <div className="stream-status-bar-label">Loading...</div>
          </div>
        )
      ) : // Display the actual data once loaded
      chartType === "pie" ? (
        <PieChart
          data={[{ value: timeLeft, color: "#111" }]}
          totalValue={totalTime}
          lineWidth={20}
          background="#bfbfbf"
          rounded
          animate
          label={() => `${Math.round(percentageLeft)}%`}
          labelPosition={0}
        />
      ) : (
        <div className="stream-status-bar-container">
          <div
            className="stream-status-bar-progress"
            style={{
              width: `${percentageLeft}%`,
            }}
          />
          <div className="stream-status-bar-label">
            {Math.round(percentageLeft)}% left
          </div>
        </div>
      )}
    </>
  );
};

export default StreamStatus;
