import React from "react";
import { useParams } from "react-router-dom";

const StreamPage = () => {
  const { sm, creator } = useParams();

  return (
    <div>
      <h1>Stream Details</h1>
      <div> SM: {sm} </div>
      <div> Creator: {creator} </div>
    </div>
  );
};

export default StreamPage;
