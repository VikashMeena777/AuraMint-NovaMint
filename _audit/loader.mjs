/**
 * Minimal ESM resolve hook so the regression tests can import the application's
 * TypeScript modules directly (Node 24 strips types natively):
 *   - `@/x`  →  <project>/src/x  (+ .ts / .tsx / index.*)
 *   - `./x`  →  extension resolution for TS files
 *
 * Test-only. Never imported by application code.
 */

import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(projectRoot, "src");

const EXTENSIONS = [".ts", ".mts", ".js", ".mjs", ".tsx"];
const INDEX_FILES = ["index.ts", "index.mts", "index.js", "index.mjs"];

function resolveFile(target) {
  if (existsSync(target) && statSync(target).isFile()) return target;
  for (const ext of EXTENSIONS) {
    const candidate = `${target}${ext}`;
    if (existsSync(candidate)) return candidate;
  }
  for (const indexFile of INDEX_FILES) {
    const candidate = path.join(target, indexFile);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  // Alias used everywhere in the app (tsconfig paths: "@/*" -> "./src/*")
  if (specifier.startsWith("@/")) {
    const resolved = resolveFile(path.join(srcRoot, specifier.slice(2)));
    if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true };
  }

  // Extensionless relative imports (Next/TS allow them, Node does not)
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const target = path.resolve(parentDir, specifier);
    if (!path.extname(target)) {
      const resolved = resolveFile(target);
      if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true };
    }
  }

  // `next/server` (subpath of a CJS package without a matching exports entry) —
  // retry with the .js extension Node suggests before giving up.
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err && err.code === "ERR_MODULE_NOT_FOUND" && !specifier.endsWith(".js")) {
      return nextResolve(`${specifier}.js`, context);
    }
    throw err;
  }
}
