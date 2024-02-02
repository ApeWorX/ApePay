import React, { ReactNode } from "react";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { useTheme } from "./ThemeContext";
import { Chain } from "wagmi";

type ThemedRainbowKitProviderProps = {
  children: ReactNode;
  chains: Chain[];
};

const ThemedRainbowKitProvider: React.FC<ThemedRainbowKitProviderProps> = ({
  children,
  chains,
}) => {
  const { theme } = useTheme();

  const sakura = {
    colors: {
      accentColor: "hsl(338 100% 84%)",
      accentColorForeground: "hsl(225, 0%, 0%)",
      actionButtonBorder: "hsl(338 100% 84%)",
      actionButtonBorderMobile: "hsl(338 100% 84%)",
      actionButtonSecondaryBackground: "hsl(338 100% 84%)",
      closeButton: "hsl(340 8% 58%)",
      closeButtonBackground: "hsl(339 52% 77%)",
      connectButtonBackground: "hsl(338 100% 84%)",
      connectButtonBackgroundError: "hsl(338 100% 84%)",
      connectButtonInnerBackground: "hsl(339 71% 80%)",
      connectButtonText: "hsl(225, 0%, 0%)",
      connectButtonTextError: "hsl(225, 0%, 0%)",
      error: "hsl(225, 0%, 0%)",
      generalBorder: "hsl(180, 0%, 94%)",
      generalBorderDim: "rgba(0, 0, 0, 0.03)",
      menuItemBackground: "hsl(339 71% 80%)",
      modalBackdrop: "rgba(0, 0, 0, 0.5)",
      modalBackground: "hsl(338 100% 84%)",
      modalBorder: "hsl(180, 0%, 94%)",
      modalText: "hsl(225, 0%, 0%)",
      modalTextDim: "rgba(60, 66, 66, 0.3)",
      modalTextSecondary: "hsl(200,1%,55%)",
      profileAction: "hsl(339 71% 80%)",
      profileActionHover: "hsl(339 52% 77%)",
      profileForeground: "hsl(338 100% 84%)",
      selectedOptionBorder: "hsl(338 100% 84%)",
      downloadBottomCardBackground:
        "linear-gradient(126deg, rgba(255, 255, 255, 0) 9.49%, rgba(171, 171, 171, 0.04) 71.04%), #FFFFFF",
      downloadTopCardBackground:
        "linear-gradient(126deg, rgba(171, 171, 171, 0.2) 9.49%, rgba(255, 255, 255, 0) 71.04%), #FFFFFF",
      connectionIndicator: "hsl(107, 100%, 44%)",
      standby: "hsl(47, 100%, 63%)",
    },
    radii: {
      actionButton: "9999px",
      connectButton: "12px",
      menuButton: "12px",
      modal: "24px",
      modalMobile: "24px",
    },
    shadows: {
      connectButton: "0px 8px 32px rgba(0,0,0,.32)",
      dialog: "0px 8px 32px rgba(0,0,0,.32)",
      profileDetailsAction: "0px 2px 6px rgba(37, 41, 46, 0.04)",
      selectedOption: "0px 2px 6px rgba(0, 0, 0, 0.24)",
      selectedWallet: "0px 2px 6px rgba(0, 0, 0, 0.12)",
      walletLogo: "0px 2px 16px rgba(0, 0, 0, 0.16)",
    },
    blurs: {
      modalOverlay: "blur(0px)", // e.g. 'blur(4px)'
    },
    fonts: {
      body: "...", // default
    },
  };

  const nord = {
    colors: {
      accentColor: "hsl(219 28% 88%)",
      accentColorForeground: "hsl(225, 0%, 0%)",
      actionButtonBorder: "hsl(219 28% 88%)",
      actionButtonBorderMobile: "hsl(219 28% 88%)",
      actionButtonSecondaryBackground: "hsl(219 28% 88%)",
      closeButton: "hsl(219 2% 58%)",
      closeButtonBackground: "hsl(219 12% 79%)",
      connectButtonBackground: "hsl(219 28% 88%)",
      connectButtonBackgroundError: "hsl(219 28% 88%)",
      connectButtonInnerBackground: "hsl(219 18% 84%)",
      connectButtonText: "hsl(225, 0%, 0%)",
      connectButtonTextError: "hsl(225, 0%, 0%)",
      error: "hsl(225, 0%, 0%)",
      generalBorder: "hsl(180, 0%, 94%)",
      generalBorderDim: "rgba(0, 0, 0, 0.03)",
      menuItemBackground: "hsl(219 18% 84%)",
      modalBackdrop: "rgba(0, 0, 0, 0.5)",
      modalBackground: "hsl(219 28% 88%)",
      modalBorder: "hsl(180, 0%, 94%)",
      modalText: "hsl(225, 0%, 0%)",
      modalTextDim: "rgba(60, 66, 66, 0.3)",
      modalTextSecondary: "hsl(200,1%,55%)",
      profileAction: "hsl(219 18% 84%)",
      profileActionHover: "hsl(219 12% 79%)",
      profileForeground: "hsl(219 28% 88%)",
      selectedOptionBorder: "hsl(219 28% 88%)",
      downloadBottomCardBackground:
        "linear-gradient(126deg, rgba(255, 255, 255, 0) 9.49%, rgba(171, 171, 171, 0.04) 71.04%), #FFFFFF",
      downloadTopCardBackground:
        "linear-gradient(126deg, rgba(171, 171, 171, 0.2) 9.49%, rgba(255, 255, 255, 0) 71.04%), #FFFFFF",
      connectionIndicator: "hsl(107, 100%, 44%)",
      standby: "hsl(47, 100%, 63%)",
    },
    radii: {
      actionButton: "9999px",
      connectButton: "12px",
      menuButton: "12px",
      modal: "24px",
      modalMobile: "24px",
    },
    shadows: {
      connectButton: "0px 8px 32px rgba(0,0,0,.32)",
      dialog: "0px 8px 32px rgba(0,0,0,.32)",
      profileDetailsAction: "0px 2px 6px rgba(37, 41, 46, 0.04)",
      selectedOption: "0px 2px 6px rgba(0, 0, 0, 0.24)",
      selectedWallet: "0px 2px 6px rgba(0, 0, 0, 0.12)",
      walletLogo: "0px 2px 16px rgba(0, 0, 0, 0.16)",
    },
    blurs: {
      modalOverlay: "blur(0px)", // e.g. 'blur(4px)'
    },
    fonts: {
      body: "...", // default
    },
  };

  const tokyoNight = {
    colors: {
      accentColor: "hsl(169 100% 50%)",
      accentColorForeground: "hsl(225, 0%, 0%)",
      actionButtonBorder: "hsl(169 100% 50%)",
      actionButtonBorderMobile: "hsl(169 100% 50%)",
      actionButtonSecondaryBackground: "hsl(169 100% 50%)",
      closeButton: "hsl(161 14% 55%)",
      closeButtonBackground: "hsl(165 72% 60%)",
      connectButtonBackground: "hsl(169 100% 50%)",
      connectButtonBackgroundError: "hsl(169 100% 50%)",
      connectButtonInnerBackground: "hsl(167 86% 59%)",
      connectButtonText: "hsl(225, 0%, 0%)",
      connectButtonTextError: "hsl(225, 0%, 0%)",
      error: "hsl(225, 0%, 0%)",
      generalBorder: "hsl(180, 0%, 94%)",
      generalBorderDim: "rgba(0, 0, 0, 0.03)",
      menuItemBackground: "hsl(167 86% 59%)",
      modalBackdrop: "rgba(0, 0, 0, 0.5)",
      modalBackground: "hsl(169 100% 50%)",
      modalBorder: "hsl(180, 0%, 94%)",
      modalText: "hsl(225, 0%, 0%)",
      modalTextDim: "rgba(60, 66, 66, 0.3)",
      modalTextSecondary: "hsl(0, 0%, 60%)",
      profileAction: "hsl(167 86% 59%)",
      profileActionHover: "hsl(165 72% 60%)",
      profileForeground: "hsl(169 100% 50%)",
      selectedOptionBorder: "hsl(169 100% 50%)",
      downloadBottomCardBackground:
        "linear-gradient(126deg, rgba(255, 255, 255, 0) 9.49%, rgba(171, 171, 171, 0.04) 71.04%), #FFFFFF",
      downloadTopCardBackground:
        "linear-gradient(126deg, rgba(171, 171, 171, 0.2) 9.49%, rgba(255, 255, 255, 0) 71.04%), #FFFFFF",
      connectionIndicator: "hsl(107, 100%, 44%)",
      standby: "hsl(47, 100%, 63%)",
    },
    radii: {
      actionButton: "12px",
      connectButton: "6px",
      menuButton: "6px",
      modal: "12px",
      modalMobile: "12px",
    },
    shadows: {
      connectButton: "0px 8px 32px rgba(0, 0, 0, 0.32)",
      dialog: "0px 8px 32px rgba(0, 0, 0, 0.32)",
      profileDetailsAction: "0px 2px 6px rgba(37, 41, 46, 0.04)",
      selectedOption: "0px 2px 6px rgba(0, 0, 0, 0.24)",
      selectedWallet: "0px 2px 6px rgba(0, 0, 0, 0.12)",
      walletLogo: "0px 2px 16px rgba(0, 0, 0, 0.16)",
    },
    blurs: {
      modalOverlay: "blur(0px)", // e.g. 'blur(4px)'
    },
    fonts: {
      body: "...", // default
    },
  };

  const customTheme =
    theme === "sakura" ? sakura : theme === "tokyoNight" ? tokyoNight : nord;
  return (
    <RainbowKitProvider theme={customTheme} chains={chains}>
      {children}
    </RainbowKitProvider>
  );
};

export default ThemedRainbowKitProvider;
