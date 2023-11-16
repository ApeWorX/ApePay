import React from "react";
import { useParams } from "react-router-dom";
import BackButton from "./BackButton";

const StreamPage = () => {
  const { sm } = useParams();

  return (
    <>
      <h1>Create Stream on {sm}</h1>
      <BackButton />
    </>
  );
};

export default StreamPage;
