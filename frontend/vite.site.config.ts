import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * GitHub Pages 用（LPとご利用ガイドだけ）のビルド設定。
 * 公開URLが https://<user>.github.io/<repo>/ になるため、base はリポジトリ名にする。
 * 独自ドメインなど別の場所に置くときは、SITE_BASE=/ でビルドする。
 */
export default defineConfig({
  base: process.env.SITE_BASE ?? "/fx-review/",
  plugins: [react()],
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
