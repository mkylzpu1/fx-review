import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * SNS・LINEのカード表示（og:image など）は絶対URLでないと読まれない。
 * site.html の __SITE_URL__ を、公開URL（末尾のスラッシュなし）に置き換える。
 * 独自ドメインなどに置くときは、SITE_URL=https://example.com SITE_BASE=/ でビルドする。
 * Vite が画像の相対パスとして解決してしまわないよう、order: "pre" で先に置き換える。
 */
const SITE_URL = (
  process.env.SITE_URL ?? "https://mkylzpu1.github.io/fx-review"
).replace(/\/+$/, "");

function siteUrlPlugin(): Plugin {
  return {
    name: "site-url",
    transformIndexHtml: {
      order: "pre",
      handler: (html) => html.replaceAll("__SITE_URL__", SITE_URL),
    },
  };
}

/**
 * GitHub Pages 用（LPとご利用ガイドだけ）のビルド設定。
 * 公開URLが https://<user>.github.io/<repo>/ になるため、base はリポジトリ名にする。
 * 独自ドメインなど別の場所に置くときは、SITE_BASE=/ でビルドする。
 */
export default defineConfig({
  base: process.env.SITE_BASE ?? "/fx-review/",
  plugins: [react(), siteUrlPlugin()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  define: {
    "import.meta.env.VITE_PUBLIC_SITE": JSON.stringify("1"),
  },
  build: {
    outDir: "dist-site",
    emptyOutDir: true,
    rollupOptions: { input: path.resolve(__dirname, "site.html") },
  },
});
