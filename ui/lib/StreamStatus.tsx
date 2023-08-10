import * as React from "react";
import { PieChart } from "react-minimal-pie-chart";

import { Stream } from "@apeworx/apepay";

export interface StreamStatusProps {
  stream: Stream;
}

const StreamStatus = (props: StreamStatusProps) => {
  const [timeLeft, setTimeLeft] = React.useState(1); // using `1` to start w/ 100% left
  React.useEffect(() => {
    props.stream.timeLeft().then(setTimeLeft).catch(console.error);
  }, [timeLeft]);

  const [totalTime, setTotalTime] = React.useState(1); // using `1` to avoid NaN
  React.useEffect(() => {
    props.stream.totalTime().then(setTotalTime).catch(console.error);
  }, [totalTime]);

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
