import React from "react";
import { useNavigate } from "react-router-dom";

const Header = () => {
  const navigate = useNavigate();

  return (
    <div className="header-button">
      <button onClick={() => navigate(-1)}>Go Back</button>
      <button onClick={() => navigate("/")}>Homepage</button>
    </div>
  );
};

export default Header;
