import { copyFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await Promise.all([
  copyFile(join(root, "404.html"), join(dist, "index.html")),
  copyFile(join(root, "main.js"), join(dist, "main.js")),
  copyFile(join(root, "style.css"), join(dist, "style.css")),
]);

console.log("Static site built in dist/");
