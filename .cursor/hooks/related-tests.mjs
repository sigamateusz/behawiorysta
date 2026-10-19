// postToolUse (Write): run the Vitest tests related to the edited file.

import fs from "node:fs";
import path from "node:path";
import {
  checkoutFor,
  editedFile,
  feedback,
  isTestFile,
  parsePayload,
  readStdin,
  registerRoot,
  runTool,
  toPosix,
} from "./hook-lib.mjs";

const payload = parsePayload(await readStdin());
const edited = editedFile(payload);
if (!edited || !isTestFile(edited.abs) || !fs.existsSync(edited.abs)) process.exit(0);

const root = checkoutFor(edited.abs, edited.cwd);
if (!root) process.exit(0);
registerRoot(payload, root);

const relative = toPosix(path.relative(root, edited.abs));
const tests = runTool(root, "vitest", ["related", relative, "--run"]);
if (tests.missing) {
  feedback("additional_context", `Vitest did not run for ${relative}: node_modules/vitest/vitest.mjs is missing.`);
} else if (tests.status !== 0) {
  feedback("additional_context", `Tests related to ${relative} fail:\n${tests.output || "(no output)"}`);
}
process.exit(0);
