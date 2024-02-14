import React from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "./ThemeContext";
import { Button, Popover, Pane, ArrowLeftIcon } from "evergreen-ui";

interface HeaderProps {
  showNavButtons?: boolean;
}

const Header: React.FC<HeaderProps> = ({ showNavButtons = true }) => {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const themes = ["sakura", "tokyoNight", "nord"];

  return (
    <div className={`app ${theme}`}>
      {showNavButtons && (
        <>
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
        </>
      )}
      <Popover
        content={
          <Pane padding={16} display="flex" flexDirection="column">
            {themes.map((t) => (
              <Button key={t} onClick={() => setTheme(t)}>
                {t}
              </Button>
            ))}
          </Pane>
        }
      >
        <Button className="theme-toggle-button">{theme}</Button>
      </Popover>
    </div>
  );
};

export default Header;
