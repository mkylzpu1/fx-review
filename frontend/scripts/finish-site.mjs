// GitHub Pages 用の仕上げ: site.html を index.html にし、深いURLの直アクセス用に 404.html も置く
import { copyFileSync, renameSync } from "node:fs";

renameSync("dist-site/site.html", "dist-site/index.html");
copyFileSync("dist-site/index.html", "dist-site/404.html");
