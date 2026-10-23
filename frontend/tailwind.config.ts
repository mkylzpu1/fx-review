import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0E1116",
        card: "#161B22",
        line: "#262D38",
        surface: "#1B222C",
        field: "#2B3441",
        tag: "#1F2630",
        ink: { DEFAULT: "#E6EAF0", sub: "#B4BDCA", mute: "#8B95A5" },
        accent: { DEFAULT: "#3E63DD", link: "#9DB4FF" },
        profit: "#6EE7C8",
        loss: "#FF7A8A",
        caution: "#F5B94A",
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      borderRadius: { card: "12px", btn: "8px", chip: "22px" },
      minHeight: { touch: "44px" },
    },
  },
  plugins: [],
} satisfies Config;
