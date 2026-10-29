// TypeScript のスクリプトを esbuild でまとめて実行する（追加の実行ツールを入れないため）
// 使い方: node scripts/run.mjs <スクリプト名> [引数...]   例: node scripts/run.mjs syncCandles --from 2026-10-01
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const [name, ...rest] = process.argv.slice(2);
if (!name || !/^[A-Za-z0-9_-]+$/.test(name)) {
  console.error("使い方: node scripts/run.mjs <スクリプト名> [引数...]");
  process.exit(1);
}
const entry = path.join(here, `${name}.ts`);
if (!existsSync(entry)) {
  console.error(`scripts/${name}.ts が見つかりません`);
  process.exit(1);
}
const outfile = path.join(here, "..", ".tmp-scripts", `${name}.cjs`);

await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  outfile,
  sourcemap: false,
  // dukascopy-node は playwright-core などを含むため、まとめずに実行時に node_modules から読む
  external: ["@aws-sdk/*", "dukascopy-node"],
});

// DB接続などの設定は backend/.env.local から読む（無ければ環境変数をそのまま使う）
try {
  process.loadEnvFile(path.join(here, "..", ".env.local"));
} catch {
  // .env.local が無いときは何もしない
}

const result = spawnSync(process.execPath, [outfile, ...rest], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
