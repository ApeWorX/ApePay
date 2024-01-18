import React from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "./ThemeContext";
import { Button, SelectMenu, ArrowLeftIcon } from "evergreen-ui";

const Header = () => {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const themes = ["sakura", "tokyoNight", "nord"]; 

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
      <SelectMenu
        title="Select Theme"
        options={themes.map((t) => ({ label: t, value: t }))}
        selected={theme}
        onSelect={(item) => setTheme(String(item.value))}
      >
        <Button className="theme-toggle-button">{theme}</Button>
      </SelectMenu>
    </div>
  );
};

export default Header;
