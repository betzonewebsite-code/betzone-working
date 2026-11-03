import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#E30613", dark: "#D30000", soft: "#FDE8EA" },
        win: { DEFAULT: "#00C261", live: "#00E676" },
        drop: "#FF3B30",
        ink: { DEFAULT: "#121212", 2: "#1A1A1A", 3: "#262626" },
        canvas: { DEFAULT: "#F4F5F7", card: "#FFFFFF", line: "#E4E6EA" },
        odds: { bg: "#F0F1F4", text: "#1A1A1A" },
      },
      fontFamily: {
        sans: ["Inter Variable", "Roboto", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": ["10px", "12px"],
        xs: ["11px", "14px"],
        sm: ["12px", "16px"],
        base: ["13px", "18px"],
      },
      spacing: { "slip": "340px", "side": "240px", "nav": "56px" },
      screens: { lg: "1024px", xl: "1280px" },
      keyframes: {
        flashUp: {
          "0%": { backgroundColor: "#00C261", color: "#fff" },
          "100%": { backgroundColor: "#F0F1F4", color: "#1A1A1A" },
        },
        flashDown: {
          "0%": { backgroundColor: "#FF3B30", color: "#fff" },
          "100%": { backgroundColor: "#F0F1F4", color: "#1A1A1A" },
        },
        livePulse: {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: ".4", transform: "scale(1.5)" },
        },
        slideIn: {
          from: { transform: "translateY(8px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        badgePop: {
          "0%": { transform: "scale(.6)" },
          "60%": { transform: "scale(1.25)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        "flash-up": "flashUp 1.2s ease-out",
        "flash-down": "flashDown 1.2s ease-out",
        "live-pulse": "livePulse 1.4s ease-in-out infinite",
        "slide-in": "slideIn .18s ease-out",
        "badge-pop": "badgePop .25s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
