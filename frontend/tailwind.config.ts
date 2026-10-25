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
        // 色は緑（上昇・利益）と赤（下降・損失）だけ。ボタン・選択・リンクは、色味のない明るいグレーにする
        accent: { DEFAULT: "#E6EAF0", link: "#D5DBE4" },
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
      keyframes: {
        loadbar: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(300%)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
