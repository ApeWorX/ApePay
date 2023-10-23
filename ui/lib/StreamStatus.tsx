import React, { useState, useEffect } from "react";
import { PieChart } from "react-minimal-pie-chart";
import { Stream } from "../../sdk/js/index";
import { formatTime } from "./utils";

export interface StreamStatusProps {
  stream: Stream;
  chartType: "bar" | "pie";
  background?: string;
  color?: string;
}

const StreamStatus: React.FC<StreamStatusProps> = (props) => {
  const [timeLeft, setTimeLeft] = useState<bigint | null>(null);
  const [totalTime, setTotalTime] = useState<bigint | null>(null);
  
  useEffect(() => {
    const fetchTimeData = async () => {
      try {
        const fetchedTimeLeft = await props.stream.timeLeft();
        setTimeLeft(fetchedTimeLeft);

        const fetchedTotalTime = await props.stream.totalTime();
        setTotalTime(fetchedTotalTime);

        // If both timeLeft and totalTime are not null, clearInterval
        if (fetchedTimeLeft !== null && fetchedTotalTime !== null) {
          clearInterval(interval);
        }
      } catch (error) {
        console.error("Error fetching time data:", error);
      }
    };

    const interval = setInterval(() => {
      fetchTimeData();
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const percentageLeft =
    timeLeft && totalTime ? (Number(timeLeft) / Number(totalTime)) * 100 : 0;

  return (
    <>
      {timeLeft === null || totalTime === null ? (
        // Loading State for pie chart
        props.chartType === "pie" ? (
          <PieChart
            data={[{ value: 1, color: props.color || "#111" }]}
            totalValue={1}
            lineWidth={20}
            background={props.background || "#bfbfbf"}
            label={() => "Loading..."}
            labelPosition={0}
          />
        ) : (
          // Loading state for bar chart
          <div
            className="stream-status-bar-container"
            style={{
              backgroundColor: props.background || "#bfbfbf",
            }}
          >
            <div
              className="stream-status-bar-progress"
              style={{
                backgroundColor: props.color || "#111",
                width: "100%",
              }}
            />
            <div className="stream-status-bar-label">Loading...</div>
          </div>
        )
      ) : // Display the actual data once loaded
      props.chartType === "pie" ? (
        <>
          <PieChart
            data={[{ value: Number(timeLeft), color: props.color || "#111" }]}
            totalValue={ Number(totalTime)}
            lineWidth={20}
            background={props.background || "#bfbfbf"}
            rounded
            animate
            label={() => `${Math.round(percentageLeft)}%`}
            labelPosition={0}
          />
          <div className="countdown-label">
            {formatTime(Number(timeLeft))} remaining
          </div>
        </>
      ) : (
        <div
          className="stream-status-bar-container"
          style={{
            backgroundColor: props.background || "#bfbfbf",
          }}
        >
          <div
            className="stream-status-bar-progress"
            style={{
              backgroundColor: props.color || "#111",
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
