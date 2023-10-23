// Display stream time with the correct units
export function formatTime(seconds: number) {
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
