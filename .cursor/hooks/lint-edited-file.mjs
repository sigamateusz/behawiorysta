// postToolUse (Write): lint the edited file. Failures come back as additional_context.
// Exit 0 with no stdout means the file was checked and clean, or there was nothing to check.

import fs from "node:fs";
import path from "node:path";
import {
  VIEW_FILES,
  checkoutFor,
  editedFile,
  feedback,
  isLintFile,
  parsePayload,
  readStdin,
  registerRoot,
  runNodeScript,
  runTool,
  toPosix,
} from "./hook-lib.mjs";

const payload = parsePayload(await readStdin());
const edited = editedFile(payload);
if (!edited || !isLintFile(edited.abs) || !fs.existsSync(edited.abs)) process.exit(0);

const root = checkoutFor(edited.abs, edited.cwd);
if (!root) process.exit(0);
registerRoot(payload, root);

const relative = toPosix(path.relative(root, edited.abs));
const parts = [];
const lint = runTool(root, "eslint", ["--quiet", relative]);
if (lint.missing) {
  parts.push(`ESLint did not run for ${relative}: node_modules/eslint/bin/eslint.js is missing.`);
} else if (lint.status !== 0) {
  parts.push(`ESLint reported errors in ${relative}:\n${lint.output || "(no output)"}`);
}

if (VIEW_FILES.has(relative)) {
  const tokens = runNodeScript(root, "scripts/check-view-tokens.mjs", []);
  if (tokens.missing) {
    parts.push(`View token check did not run for ${relative}: scripts/check-view-tokens.mjs is missing.`);
  } else if (tokens.status !== 0) {
    parts.push(`View token check failed for ${relative}:\n${tokens.output || "(no output)"}`);
  }
}

feedback("additional_context", parts.join("\n"));
process.exit(0);
