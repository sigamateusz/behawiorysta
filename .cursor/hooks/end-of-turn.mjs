// stop: lint, unit tests, and astro check for everything this turn changed. One follow-up.
// Shell writes never reach postToolUse, so this sweep is the check for those files.

import fs from "node:fs";
import path from "node:path";
import {
  VIEW_FILES,
  changedFiles,
  clearRegistry,
  feedback,
  isLintFile,
  loopCount,
  parsePayload,
  readStdin,
  runNodeScript,
  runTool,
  stopRoots,
  toPosix,
} from "./hook-lib.mjs";

const payload = parsePayload(await readStdin());
const status = typeof payload.status === "string" ? payload.status : "completed";

// RETRY_GUARD: a later stop in this conversation must be allowed to finish.
if (status !== "completed" || loopCount(payload) !== 0) process.exit(0);

const { cwd, roots, sessionRepo } = stopRoots(payload);
if (!sessionRepo || roots.length === 0) {
  process.stderr.write(`end-of-turn.mjs: no git checkout at ${cwd}, nothing checked.\n`);
  process.exit(0);
}

const parts = [];
let sawChanges = false;

for (const root of roots) {
  const changed = changedFiles(root);
  if (changed === null) {
    sawChanges = true;
    parts.push(`Could not list changes in ${root}.`);
    continue;
  }
  if (changed.length === 0) continue;
  sawChanges = true;

  const lintable = changed.filter((file) => isLintFile(file) && fs.existsSync(path.join(root, file)));
  if (lintable.length > 0) {
    const lint = runTool(root, "eslint", ["--quiet", ...lintable]);
    if (lint.missing) {
      parts.push(`ESLint did not run in ${root}: node_modules/eslint/bin/eslint.js is missing.`);
    } else if (lint.status !== 0) {
      parts.push(`ESLint errors in changed files (${root}):\n${lint.output || "(no output)"}`);
    }
  }

  const views = changed.map((file) => toPosix(file)).filter((file) => VIEW_FILES.has(file));
  if (views.length > 0) {
    const tokens = runNodeScript(root, "scripts/check-view-tokens.mjs", []);
    if (tokens.missing) {
      parts.push(`View token check did not run in ${root}: scripts/check-view-tokens.mjs is missing.`);
    } else if (tokens.status !== 0) {
      parts.push(`View token check failed (${root}):\n${tokens.output || "(no output)"}`);
    }
  }

  const tests = runTool(root, "vitest", ["run"]);
  if (tests.missing) {
    parts.push(`Vitest did not run in ${root}: node_modules/vitest/vitest.mjs is missing.`);
  } else if (tests.status !== 0) {
    parts.push(`Unit tests fail (${root}):\n${tests.output || "(no output)"}`);
  }

  const types = runTool(root, "astro", ["check"]);
  if (types.missing) {
    parts.push(`astro check did not run in ${root}: node_modules/astro/bin/astro.mjs is missing.`);
  } else if (types.status !== 0) {
    parts.push(`Typecheck fails (${root}):\n${types.output || "(no output)"}`);
  }
}

if (!sawChanges) process.exit(0);
if (parts.length > 0) feedback("followup_message", `Fix these before you finish:\n${parts.join("\n")}`);
else clearRegistry(payload);
process.exit(0);
