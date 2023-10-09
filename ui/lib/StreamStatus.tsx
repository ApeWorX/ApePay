import React, { useState, useEffect } from "react";
import { PieChart } from "react-minimal-pie-chart";
import { Stream } from "@apeworx/apepay";

export interface StreamStatusProps {
  stream: Stream;
}

const StreamStatus: React.FC<StreamStatusProps> = ({ stream }) => {
  const [timeLeft, setTimeLeft] = useState<number>(10);
  const [totalTime, setTotalTime] = useState<number>(10);

  useEffect(() => {
    stream.timeLeft().then(setTimeLeft).catch(console.error);
    stream.totalTime().then(setTotalTime).catch(console.error);
  }, [stream]);

  console.log("totaltime " + totalTime);
  console.log("timeleft " + timeLeft);

  return (
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
  );
};

export default StreamStatus;
