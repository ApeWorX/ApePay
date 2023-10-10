import React, { useState, useEffect } from "react";
import { PieChart } from "react-minimal-pie-chart";
import { Stream } from "@apeworx/apepay";

export interface StreamStatusProps {
  stream: Stream;
  chartType: 'bar' | 'pie';
}

const StreamStatus: React.FC<StreamStatusProps> = ({ stream, chartType }) => {
  const [timeLeft, setTimeLeft] = useState<number>(1);
  const [totalTime, setTotalTime] = useState<number>(1);

  useEffect(() => {
    stream.timeLeft().then(setTimeLeft).catch(console.error);
    stream.totalTime().then(setTotalTime).catch(console.error);
  }, [stream]);

  console.log("totaltime " + totalTime);
  console.log("timeleft " + timeLeft);

  const percentageLeft = (timeLeft / totalTime) * 100;

  return (
    <>
      {chartType === 'bar' ? (
        <PieChart
          data={[{ value: timeLeft, color: "#111" }]}
          totalValue={totalTime}
          lineWidth={20}
          background="#bfbfbf"
          rounded
          animate
          label={({ dataEntry }) =>
            `${Math.floor((100 * dataEntry.value) / totalTime)}%`
          }
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
