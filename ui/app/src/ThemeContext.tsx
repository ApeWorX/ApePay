import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
} from "react";

type ThemeContextType = {
  theme: string; // The current theme
  setTheme: (theme: string) => void; // Function to update the theme
};



const ThemeContext = createContext<ThemeContextType>({
  theme: "sakura", // Default value
  setTheme: () => {}, // Default function
});

type ThemeProviderProps = {
  children: ReactNode;
};

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "sakura");

  useEffect(() => {
    document.body.className = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  // No need for toggleTheme if it's not being used

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
