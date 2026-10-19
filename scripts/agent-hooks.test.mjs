import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hooksDir = path.join(repoRoot, ".cursor", "hooks");

const ESLINT_STUB = `const fs = require("node:fs");
const log = process.env.STUB_LOG;
if (log) fs.appendFileSync(log, "eslint " + process.argv.slice(2).join(" ") + "\\n");
let failed = false;
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith("-") || !fs.existsSync(arg)) continue;
  const text = fs.readFileSync(arg, "utf8");
  if (text.includes("unusedLint")) {
    console.error(arg + ": 'unusedLint' is assigned a value but never used.");
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
`;

const VITEST_STUB = `import fs from "node:fs";
import path from "node:path";
const log = process.env.STUB_LOG;
if (log) fs.appendFileSync(log, "vitest " + process.argv.slice(2).join(" ") + "\\n");
let failed = false;
function scan(file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return;
  if (fs.readFileSync(file, "utf8").includes("expect(1).toBe(2)")) {
    console.error("AssertionError: expected 1 to be 2");
    failed = true;
  }
}
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else scan(full);
  }
}
const args = process.argv.slice(2);
if (args.includes("related")) {
  for (const arg of args) if (!arg.startsWith("-")) scan(arg);
} else if (args.includes("run")) walk(process.cwd());
process.exit(failed ? 1 : 0);
`;

const ASTRO_STUB = `import fs from "node:fs";
import path from "node:path";
const log = process.env.STUB_LOG;
if (log) fs.appendFileSync(log, "astro " + process.argv.slice(2).join(" ") + "\\n");
if (!process.argv.includes("check")) process.exit(0);
let failed = false;
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (fs.readFileSync(full, "utf8").includes("HOOK_TYPE_ERROR")) {
      console.error(full + ": error TS2322");
      failed = true;
    }
  }
}
walk(process.cwd());
process.exit(failed ? 1 : 0);
`;

const TOKEN_STUB = `import fs from "node:fs";
const file = "src/pages/dashboard.astro";
const text = fs.readFileSync(file, "utf8");
if (text.includes("bg-red-500")) {
  console.error(file + ": bg-red-500");
  process.exit(1);
}
`;

function git(cwd, args) {
  const result = spawnSync("git", ["-c", "core.autocrlf=false", ...args], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    env: { ...process.env, HUSKY: "0" },
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `git ${args.join(" ")}`);
  }
  return (result.stdout || "").trim();
}

function commit(cwd, message) {
  git(cwd, ["add", "-A"]);
  git(cwd, ["-c", "user.email=hooks@example.com", "-c", "user.name=hooks", "commit", "-m", message]);
}

function removeDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

function createRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cursor-hooks-"));
  const log = path.join(dir, "stub.log");
  git(dir, ["init", "-b", "main"]);
  fs.writeFileSync(path.join(dir, ".gitignore"), "node_modules/\nstub.log\n");
  commit(dir, "init");
  return {
    dir,
    log,
    cleanup() {
      removeDir(dir);
    },
  };
}

function writeStubs(dir, which = {}) {
  const flags = { eslint: true, vitest: true, astro: true, ...which };
  if (flags.eslint) writeFile(dir, "node_modules/eslint/bin/eslint.js", ESLINT_STUB);
  if (flags.vitest) writeFile(dir, "node_modules/vitest/vitest.mjs", VITEST_STUB);
  if (flags.astro) writeFile(dir, "node_modules/astro/bin/astro.mjs", ASTRO_STUB);
}

function writeFile(dir, relative, contents) {
  const full = path.join(dir, relative);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents);
}

function runHook(script, payload, options) {
  const cwd = options.cwd ?? options.dir;
  const env = { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0", HUSKY: "0" };
  delete env.NODE_TEST_CONTEXT;
  if (options.log) env.STUB_LOG = options.log;
  env.CURSOR_PROJECT_DIR = options.cursorProjectDir ?? path.join(os.tmpdir(), "missing-cursor-project-dir");
  return spawnSync(process.execPath, [path.join(hooksDir, script)], {
    cwd,
    input: typeof payload === "string" ? payload : JSON.stringify(payload ?? {}),
    encoding: "utf8",
    env,
    windowsHide: true,
  });
}

function message(result, field) {
  const text = (result.stdout || "").trim();
  if (!text) return "";
  const parsed = JSON.parse(text);
  return parsed[field] ?? "";
}

function withRepo(fn) {
  return async (t) => {
    const repo = createRepo();
    t.after(() => repo.cleanup());
    await fn(t, repo);
  };
}

test("hook commands are node scripts in this checkout", () => {
  const config = JSON.parse(fs.readFileSync(path.join(repoRoot, ".cursor/hooks.json"), "utf8"));
  assert.equal(config.version, 1);
  assert.equal(config.hooks.postToolUse[0].timeout, 30);
  assert.equal(config.hooks.postToolUse[1].timeout, 60);
  assert.equal(config.hooks.stop[0].timeout, 120);
  assert.equal(config.hooks.stop[0].loop_limit, 1);
  const commands = [...config.hooks.postToolUse, ...config.hooks.stop].map((hook) => hook.command);
  assert.deepEqual(commands, [
    "node .cursor/hooks/lint-edited-file.mjs",
    "node .cursor/hooks/related-tests.mjs",
    "node .cursor/hooks/end-of-turn.mjs",
  ]);
  for (const command of commands) {
    const script = command.split(" ").at(-1);
    assert.equal(fs.existsSync(path.join(repoRoot, script)), true, command);
  }
});

test(
  "broken file sends additional_context naming the file and the lint error",
  withRepo((_t, repo) => {
    writeStubs(repo.dir);
    writeFile(repo.dir, "src/bad.ts", "export const unusedLint = true;\n");
    const result = runHook(
      "lint-edited-file.mjs",
      { tool_input: { file_path: path.join(repo.dir, "src/bad.ts") }, cwd: repo.dir },
      repo,
    );
    assert.equal(result.status, 0);
    const text = message(result, "additional_context");
    assert.match(text, /src\/bad\.ts/);
    assert.match(text, /unusedLint/);
    assert.match(text, /never used/);
  }),
);

test(
  "clean file exits 0 with no additional_context",
  withRepo((_t, repo) => {
    writeStubs(repo.dir);
    writeFile(repo.dir, "src/ok.ts", "export const value = 1;\n");
    const result = runHook(
      "lint-edited-file.mjs",
      { tool_input: { file_path: path.join(repo.dir, "src/ok.ts") }, cwd: repo.dir },
      repo,
    );
    assert.equal(result.status, 0);
    assert.equal((result.stdout || "").trim(), "");
  }),
);

test(
  "markdown, a missing path, an empty payload, and unparseable input are nothing to check",
  withRepo((_t, repo) => {
    writeFile(repo.dir, "README.md", "hello\n");
    const payloads = [
      { tool_input: { file_path: path.join(repo.dir, "README.md") }, cwd: repo.dir },
      { tool_input: { file_path: path.join(repo.dir, "src/missing.ts") }, cwd: repo.dir },
      {},
      { tool_name: "Shell", tool_input: { command: "npm test" }, cwd: repo.dir },
    ];
    for (const payload of payloads) {
      const result = runHook("lint-edited-file.mjs", payload, repo);
      assert.equal(result.status, 0, JSON.stringify(payload));
      assert.equal((result.stdout || "").trim(), "");
    }
    const junk = runHook("lint-edited-file.mjs", "not json", repo);
    assert.equal(junk.status, 0);
    assert.equal((junk.stdout || "").trim(), "");
  }),
);

test(
  "path and target_file are accepted, and a relative path resolves against cwd",
  withRepo((_t, repo) => {
    writeStubs(repo.dir);
    writeFile(repo.dir, "src/bad.ts", "export const unusedLint = true;\n");
    for (const toolInput of [{ path: "src/bad.ts" }, { target_file: "src/bad.ts" }]) {
      const result = runHook("lint-edited-file.mjs", { tool_input: toolInput, cwd: repo.dir }, repo);
      assert.equal(result.status, 0);
      assert.match(message(result, "additional_context"), /src\/bad\.ts/);
    }
  }),
);

test(
  "a broken file in another repository is skipped",
  withRepo((_t, repo) => {
    const other = createRepo();
    try {
      writeStubs(other.dir);
      writeFile(other.dir, "src/bad.ts", "export const unusedLint = true;\n");
      const result = runHook(
        "lint-edited-file.mjs",
        { tool_input: { file_path: path.join(other.dir, "src/bad.ts") }, cwd: repo.dir },
        repo,
      );
      assert.equal(result.status, 0);
      assert.equal((result.stdout || "").trim(), "");
    } finally {
      other.cleanup();
    }
  }),
);

test(
  "CURSOR_PROJECT_DIR pointing at a dirty checkout does not redirect the check",
  withRepo((_t, repo) => {
    const other = createRepo();
    try {
      writeStubs(repo.dir);
      writeStubs(other.dir);
      writeFile(repo.dir, "src/ok.ts", "export const value = 1;\n");
      writeFile(other.dir, "src/bad.ts", "export const unusedLint = true;\n");
      const result = runHook(
        "lint-edited-file.mjs",
        { tool_input: { file_path: path.join(repo.dir, "src/ok.ts") }, cwd: repo.dir },
        { ...repo, cursorProjectDir: other.dir },
      );
      assert.equal(result.status, 0);
      assert.equal((result.stdout || "").trim(), "");
      assert.equal(fs.readFileSync(repo.log, "utf8").includes("bad.ts"), false);
    } finally {
      other.cleanup();
    }
  }),
);

test(
  "a missing linter is reported instead of a silent success",
  withRepo((_t, repo) => {
    writeFile(repo.dir, "src/ok.ts", "export const value = 1;\n");
    const lint = runHook(
      "lint-edited-file.mjs",
      { tool_input: { file_path: path.join(repo.dir, "src/ok.ts") }, cwd: repo.dir },
      repo,
    );
    assert.equal(lint.status, 0);
    assert.match(message(lint, "additional_context"), /did not run/);
    assert.match(message(lint, "additional_context"), /eslint/);

    const tests = runHook(
      "related-tests.mjs",
      { tool_input: { file_path: path.join(repo.dir, "src/ok.ts") }, cwd: repo.dir },
      repo,
    );
    assert.equal(tests.status, 0);
    assert.match(message(tests, "additional_context"), /Vitest did not run/);
  }),
);

test(
  "related tests report a failing assertion and stay quiet when the file is clean",
  withRepo((_t, repo) => {
    writeStubs(repo.dir);
    writeFile(repo.dir, "src/math.test.ts", "expect(1).toBe(2);\n");
    const broken = runHook(
      "related-tests.mjs",
      { tool_input: { file_path: path.join(repo.dir, "src/math.test.ts") }, cwd: repo.dir },
      repo,
    );
    assert.equal(broken.status, 0);
    assert.match(message(broken, "additional_context"), /AssertionError: expected 1 to be 2/);
    assert.match(message(broken, "additional_context"), /src\/math\.test\.ts/);

    writeFile(repo.dir, "src/ok.ts", "export const value = 1;\n");
    const clean = runHook(
      "related-tests.mjs",
      { tool_input: { file_path: path.join(repo.dir, "src/ok.ts") }, cwd: repo.dir },
      repo,
    );
    assert.equal(clean.status, 0);
    assert.equal((clean.stdout || "").trim(), "");
  }),
);

test(
  "a guarded view with a palette class fails the token check",
  withRepo((_t, repo) => {
    writeStubs(repo.dir);
    writeFile(repo.dir, "scripts/check-view-tokens.mjs", TOKEN_STUB);
    writeFile(repo.dir, "src/pages/dashboard.astro", '<div class="bg-red-500"></div>\n');
    const result = runHook(
      "lint-edited-file.mjs",
      { tool_input: { file_path: path.join(repo.dir, "src/pages/dashboard.astro") }, cwd: repo.dir },
      repo,
    );
    assert.equal(result.status, 0);
    assert.match(message(result, "additional_context"), /bg-red-500/);
    assert.match(message(result, "additional_context"), /dashboard\.astro/);
  }),
);

test(
  "end of turn reports a lint error written on disk without a per-edit payload",
  withRepo((_t, repo) => {
    writeStubs(repo.dir);
    writeFile(repo.dir, "src/bad.ts", "export const unusedLint = true;\n");
    writeFile(repo.dir, "src/bad.test.ts", "expect(1).toBe(2);\n");
    writeFile(repo.dir, "src/typed.ts", "export const broken = 'HOOK_TYPE_ERROR';\n");
    const result = runHook("end-of-turn.mjs", { status: "completed", loop_count: 0, cwd: repo.dir }, repo);
    assert.equal(result.status, 0);
    const text = message(result, "followup_message");
    assert.match(text, /src\/bad\.ts/);
    assert.match(text, /unusedLint/);
    assert.match(text, /AssertionError: expected 1 to be 2/);
    assert.match(text, /TS2322/);
  }),
);

test(
  "end of turn with loop_count set exits 0 and does not run checks",
  withRepo((_t, repo) => {
    writeStubs(repo.dir);
    writeFile(repo.dir, "src/bad.ts", "export const unusedLint = true;\n");
    const result = runHook("end-of-turn.mjs", { status: "completed", loop_count: 1, cwd: repo.dir }, repo);
    assert.equal(result.status, 0);
    assert.equal((result.stdout || "").trim(), "");
    assert.equal(fs.existsSync(repo.log), false);
  }),
);

test(
  "end of turn with no changed files exits 0 without running checks",
  withRepo((_t, repo) => {
    writeStubs(repo.dir);
    const result = runHook("end-of-turn.mjs", { status: "completed", loop_count: 0, cwd: repo.dir }, repo);
    assert.equal(result.status, 0);
    assert.equal((result.stdout || "").trim(), "");
    assert.equal(fs.existsSync(repo.log), false);
  }),
);

test(
  "a clean changed file passes end of turn with no follow-up",
  withRepo((_t, repo) => {
    writeStubs(repo.dir);
    writeFile(repo.dir, "src/ok.ts", "export const value = 1;\n");
    const result = runHook("end-of-turn.mjs", { status: "completed", loop_count: 0, cwd: repo.dir }, repo);
    assert.equal(result.status, 0);
    assert.equal((result.stdout || "").trim(), "");
    const log = fs.readFileSync(repo.log, "utf8");
    assert.match(log, /^eslint /m);
    assert.match(log, /^vitest /m);
    assert.match(log, /^astro /m);
  }),
);

test(
  "an aborted stop and an unparseable payload on a clean tree succeed",
  withRepo((_t, repo) => {
    writeFile(repo.dir, "src/bad.ts", "export const unusedLint = true;\n");
    const aborted = runHook("end-of-turn.mjs", { status: "aborted", loop_count: 0, cwd: repo.dir }, repo);
    assert.equal(aborted.status, 0);
    assert.equal((aborted.stdout || "").trim(), "");

    commit(repo.dir, "keep the tree clean");
    const empty = runHook("end-of-turn.mjs", "not json", repo);
    assert.equal(empty.status, 0);
    assert.equal((empty.stdout || "").trim(), "");
  }),
);

test(
  "end of turn reports a missing typechecker instead of passing",
  withRepo((_t, repo) => {
    writeStubs(repo.dir, { astro: false });
    writeFile(repo.dir, "src/ok.ts", "export const value = 1;\n");
    const result = runHook("end-of-turn.mjs", { status: "completed", loop_count: 0, cwd: repo.dir }, repo);
    assert.equal(result.status, 0);
    assert.match(message(result, "followup_message"), /astro check did not run/);
  }),
);

test(
  "an edit in a sibling worktree is swept even when stop cwd is the main checkout",
  withRepo((_t, repo) => {
    writeFile(repo.dir, "src/ok.ts", "export const value = 1;\n");
    commit(repo.dir, "ok");
    const worktree = path.join(os.tmpdir(), `cursor-hooks-wt-${path.basename(repo.dir)}`);
    git(repo.dir, ["worktree", "add", "--detach", worktree]);
    try {
      writeStubs(worktree);
      writeFile(worktree, "src/bad.ts", "export const unusedLint = true;\n");
      const edited = runHook(
        "lint-edited-file.mjs",
        {
          conversation_id: "worktree-session",
          tool_input: { file_path: path.join(worktree, "src/bad.ts") },
          cwd: worktree,
        },
        { ...repo, log: path.join(worktree, "stub.log") },
      );
      assert.match(message(edited, "additional_context"), /unusedLint/);

      const stop = runHook(
        "end-of-turn.mjs",
        { status: "completed", loop_count: 0, cwd: repo.dir, conversation_id: "worktree-session" },
        { ...repo, cursorProjectDir: path.join(os.tmpdir(), "missing-cursor-project-dir") },
      );
      assert.equal(stop.status, 0);
      const text = message(stop, "followup_message");
      assert.match(text, /bad\.ts/);
      assert.match(text, /unusedLint/);
    } finally {
      git(repo.dir, ["worktree", "remove", "--force", worktree]);
      removeDir(worktree);
    }
  }),
);

test("config commands run from a worktree when CURSOR_PROJECT_DIR does not exist", () => {
  const repo = createRepo();
  const worktree = path.join(os.tmpdir(), `cursor-hooks-cmd-${path.basename(repo.dir)}`);
  try {
    fs.cpSync(hooksDir, path.join(repo.dir, ".cursor", "hooks"), { recursive: true });
    commit(repo.dir, "hooks");
    git(repo.dir, ["worktree", "add", "--detach", worktree]);
    const config = JSON.parse(fs.readFileSync(path.join(repoRoot, ".cursor/hooks.json"), "utf8"));
    const commands = [...config.hooks.postToolUse, ...config.hooks.stop].map((hook) => hook.command);
    for (const command of commands) {
      const env = { ...process.env, CURSOR_PROJECT_DIR: path.join(os.tmpdir(), "missing-cursor-project-dir") };
      delete env.NODE_TEST_CONTEXT;
      const result = spawnSync(command, {
        cwd: worktree,
        shell: true,
        input: "{}",
        encoding: "utf8",
        env,
        windowsHide: true,
      });
      assert.equal(result.status, 0, `${command}\n${result.stdout}\n${result.stderr}`);
    }
  } finally {
    git(repo.dir, ["worktree", "remove", "--force", worktree]);
    removeDir(worktree);
    repo.cleanup();
  }
});
