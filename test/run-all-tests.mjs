import { execSync } from "node:child_process";
import { unlinkSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const entryPoint = resolve(__dirname, "run-all.ts");
const outFile = resolve(__dirname, ".antigravity-tmp-tests.mjs");

try {
  console.log("⚙️  Compiling test suites with esbuild...\n");
  execSync(
    `npx esbuild "${entryPoint}" --bundle --platform=node --format=esm --outfile="${outFile}" --external:firebase/*`,
    { stdio: "inherit" }
  );

  execSync(`node "${outFile}"`, { stdio: "inherit" });
} catch (error) {
  process.exit(1);
} finally {
  if (existsSync(outFile)) {
    try {
      unlinkSync(outFile);
    } catch {
      // Ignore cleanup error
    }
  }
}
