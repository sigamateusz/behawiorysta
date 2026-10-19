// Fails when a guarded view uses a literal color, a palette class, a square-bracket length, or bg-cosmic.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const viewFiles = [
  "src/pages/dashboard.astro",
  "src/pages/dashboard/[id].astro",
  "src/components/Topbar.astro",
  "src/components/dashboard/DashboardCard.tsx",
  "src/pages/dev/dashboard-states.astro",
];

const palette =
  /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(|-\[[0-9.]+(px|rem)\]|\b(bg|text|border|ring|outline|from|via|to|fill|stroke|shadow|divide)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)\b/;

let failed = false;

for (const file of viewFiles) {
  const text = readFileSync(join(root, file), "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (palette.test(line) || line.includes("bg-cosmic")) {
      console.error(`${file}: ${line}`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}
