import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0E1116",
        card: "#161B22",
        // 線は、背景の紺とは別に、ほんのり緑がかったグレーにする
        line: "#26352F",
        surface: "#1B222C",
        field: "#2D3E38",
        tag: "#1F2630",
        ink: { DEFAULT: "#E6EAF0", sub: "#B4BDCA", mute: "#8B95A5" },
        // 主役の色はローソク足と同じ緑。ボタン・選択・リンクに使う（赤は下降・損失・危険な操作）
        accent: { DEFAULT: "#6EE7C8", link: "#8FF0D8" },
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
