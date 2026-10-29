// GitHub Pages 用の仕上げ: site.html を index.html にする。
// GitHub Pages は、フォルダに index.html が無い URL を 404 のステータスで返す（LINE・X などはそのページをカードにしない）。
// そのため、LP と ご利用ガイドの URL（/lp/・/guide/）にも、同じ index.html を実体として置く。
// 深いURLの直アクセス用に 404.html も置く
import { copyFileSync, mkdirSync, renameSync } from "node:fs";

renameSync("dist-site/site.html", "dist-site/index.html");
for (const dir of ["lp", "guide"]) {
  mkdirSync(`dist-site/${dir}`, { recursive: true });
  copyFileSync("dist-site/index.html", `dist-site/${dir}/index.html`);
}
copyFileSync("dist-site/index.html", "dist-site/404.html");
