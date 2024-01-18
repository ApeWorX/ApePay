import React from "react";
import { useNavigate } from "react-router-dom";
import { Button, ArrowLeftIcon } from "evergreen-ui";
import { useTheme } from "./ThemeContext";

const Header = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();

  return (
    <div className={`app ${theme}`}>
      <Button
        className="theme-header-button"
        iconBefore={ArrowLeftIcon}
        onClick={() => navigate(-1)}
      >
        Previous
      </Button>
      <Button className="theme-header-button" onClick={() => navigate("/")}>
        Homepage
      </Button>
    </div>
  );
};

export default Header;
