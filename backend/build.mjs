import * as esbuild from "esbuild";

/**
 * Lambda関数のエントリーポイント一覧
 * 新しいハンドラーを追加したらここに追記する
 */
const handlers = [
  "src/handlers/auth/me.ts",
  "src/handlers/auth/withdrawal.ts",
  "src/handlers/auth/registrationStatus.ts",
  "src/handlers/settings/index.ts",
  "src/handlers/currencyPairs/index.ts",
  "src/handlers/tags/index.ts",
  "src/handlers/rules/index.ts",
  "src/handlers/trades/index.ts",
  "src/handlers/candles/index.ts",
  "src/handlers/imports/index.ts",
  "src/handlers/stats/index.ts",
  // TODO: 機能ハンドラーをここに追加する
  // "src/handlers/example/index.ts",
];

await esbuild.build({
  entryPoints: handlers,
  bundle: true,
  platform: "node",
  target: "node20",
  outdir: "dist",
  outbase: "src",
  format: "cjs",
  sourcemap: false,
  external: [
    "@aws-sdk/*", // Lambda実行環境に同梱済み
  ],
});
