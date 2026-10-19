// Shared payload, checkout, and tool lookup for the Cursor agent hooks.
// Checkout comes from the edited file and the payload cwd. CURSOR_PROJECT_DIR is ignored:
// it stays on the session's original checkout after a worktree change.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const LINT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".astro", ".mts", ".cts"]);
export const TEST_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]);

// Same list as scripts/check-view-tokens.mjs. The token script always scans all of them.
export const VIEW_FILES = new Set([
  "src/pages/dashboard.astro",
  "src/pages/dashboard/[id].astro",
  "src/components/Topbar.astro",
  "src/components/dashboard/DashboardCard.tsx",
  "src/pages/dev/dashboard-states.astro",
]);

const TOOLS = {
  eslint: ["node_modules/eslint/bin/eslint.js"],
  vitest: ["node_modules/vitest/vitest.mjs"],
  astro: ["node_modules/astro/bin/astro.mjs"],
};

export async function readStdin() {
  if (process.stdin.isTTY) return "";
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

export function parsePayload(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return {};
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function sessionId(payload) {
  const value = payload.conversation_id || payload.session_id || "";
  const safe = String(value).replace(/[^A-Za-z0-9_-]/g, "");
  return safe || null;
}

function toolInput(payload) {
  const input = payload.tool_input;
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return input && typeof input === "object" ? input : {};
}

export function editedFile(payload) {
  const input = toolInput(payload);
  const raw = input.file_path || input.path || input.target_file || input.filePath || payload.file_path;
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const cwd = typeof payload.cwd === "string" && payload.cwd.trim() ? payload.cwd : process.cwd();
  const abs = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(cwd, raw);
  return { abs, cwd: path.resolve(cwd) };
}

function childEnv() {
  return { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" };
}

function git(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: childEnv(),
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) return null;
  return (result.stdout ?? "").replace(/\r\n/g, "\n").trim();
}

function samePath(left, right) {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function gitTop(cwd) {
  const top = git(cwd, ["rev-parse", "--show-toplevel"]);
  return top ? path.resolve(top) : null;
}

function gitCommonDir(cwd) {
  const dir = git(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  return dir ? path.resolve(dir) : null;
}

export function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

// Null when the file is outside the session repository (another repo, or not a checkout).
export function checkoutFor(absFile, cwd) {
  const root = gitTop(path.dirname(absFile));
  if (!root) return null;
  const fileRepo = gitCommonDir(root);
  const sessionRepo = gitCommonDir(cwd);
  if (!fileRepo || !sessionRepo || !samePath(fileRepo, sessionRepo)) return null;
  return root;
}

function registryFile(id) {
  if (!id) return null;
  return path.join(os.tmpdir(), "cursor-hooks", `${id}.roots`);
}

export function registerRoot(payload, root) {
  const file = registryFile(sessionId(payload));
  if (!file) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${path.resolve(root)}\n`, "utf8");
}

export function clearRegistry(payload) {
  const file = registryFile(sessionId(payload));
  if (file && fs.existsSync(file)) fs.rmSync(file, { force: true });
}

export function stopRoots(payload) {
  const cwd = typeof payload.cwd === "string" && payload.cwd.trim() ? path.resolve(payload.cwd) : process.cwd();
  const sessionRepo = gitCommonDir(cwd);
  const candidates = [];
  const top = gitTop(cwd);
  if (top) candidates.push(top);
  const file = registryFile(sessionId(payload));
  if (file && fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      if (line.trim()) candidates.push(path.resolve(line.trim()));
    }
  }
  const roots = [];
  for (const root of candidates) {
    if (!sessionRepo || !fs.existsSync(root)) continue;
    const repo = gitCommonDir(root);
    if (repo && samePath(repo, sessionRepo) && !roots.some((known) => samePath(known, root))) roots.push(root);
  }
  return { cwd, roots, sessionRepo };
}

export function changedFiles(root) {
  const diff = git(root, ["diff", "--name-only", "HEAD"]);
  const untracked = git(root, ["ls-files", "-o", "--exclude-standard"]);
  if (diff === null || untracked === null) return null;
  return [...new Set(`${diff}\n${untracked}`.split("\n").map((line) => line.trim()).filter(Boolean))];
}

export function isLintFile(filePath) {
  return LINT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function isTestFile(filePath) {
  return TEST_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function cap(text) {
  const value = (text ?? "").trim();
  if (value.length <= 8000) return value;
  return `${value.slice(0, 8000)}\n…(truncated)`;
}

function spawnNode(root, script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
    env: childEnv(),
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) {
    const missing = result.error.code === "ENOENT";
    return { missing, output: result.error.message, status: missing ? null : 1 };
  }
  return {
    missing: false,
    output: cap(`${result.stdout ?? ""}${result.stderr ?? ""}`),
    status: result.status ?? 1,
  };
}

export function runTool(root, name, args) {
  for (const relative of TOOLS[name]) {
    const script = path.join(root, relative);
    if (fs.existsSync(script)) return spawnNode(root, script, args);
  }
  return { missing: true, output: "", status: null };
}

export function runNodeScript(root, relative, args) {
  const script = path.join(root, relative);
  if (!fs.existsSync(script)) return { missing: true, output: "", status: null };
  return spawnNode(root, script, args);
}

export function feedback(field, message) {
  const text = message.trim();
  if (!text) return;
  process.stdout.write(`${JSON.stringify({ [field]: text })}\n`);
}

export function loopCount(payload) {
  const value = payload.loop_count ?? 0;
  const count = typeof value === "number" ? value : Number(value);
  return Number.isFinite(count) ? count : 0;
}
