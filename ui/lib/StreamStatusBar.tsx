import React, { useState, useEffect } from "react";
import { Stream } from "@apeworx/apepay";

interface StreamStatusBarProps {
  stream: Stream;
}

const StreamStatusBar: React.FC<StreamStatusBarProps> = ({ stream }) => {
  const [timeLeft, setTimeLeft] = useState<number>(10);
  const [totalTime, setTotalTime] = useState<number>(10);

  useEffect(() => {
    stream.timeLeft().then(setTimeLeft).catch(console.error);
    stream.totalTime().then(setTotalTime).catch(console.error);
  }, [stream]);

  const percentageLeft = (timeLeft / totalTime) * 100;

  return (
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
  );
};

export default StreamStatusBar;
