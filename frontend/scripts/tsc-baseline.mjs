#!/usr/bin/env node
/**
 * Ratchet de erros de tipo (tsc).
 *
 * Roda `tsc --noEmit`, conta erros por arquivo e compara com `tsc-baseline.json`.
 * Falha (exit 1) se o total aumentar OU se qualquer arquivo tiver mais erros que no baseline
 * (inclusive arquivo novo com erro) — assim não dá para "compensar" um erro novo corrigindo outro.
 *
 * Uso:
 *   npm run typecheck:baseline            # checa
 *   npm run typecheck:baseline -- --update  # regrava o baseline (use SÓ ao reduzir erros)
 *
 * O baseline só pode diminuir: --update recusa gravar se o total subir (use --force para exceção
 * consciente, que deve ser justificada no PR).
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = resolve(root, "tsc-baseline.json");
const args = new Set(process.argv.slice(2));

function runTsc() {
  const bin = resolve(root, "node_modules", "typescript", "bin", "tsc");
  const r = spawnSync(process.execPath, [bin, "--noEmit", "--pretty", "false"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) throw r.error;
  const out = `${r.stdout || ""}\n${r.stderr || ""}`;
  const perFile = {};
  let total = 0;
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/^(.+?)\(\d+,\d+\): error TS\d+:/);
    if (!m) continue;
    const file = m[1].replace(/\\/g, "/");
    perFile[file] = (perFile[file] || 0) + 1;
    total++;
  }
  // tsc falhou sem reportar erros de tipo (ex.: tsconfig quebrado) → não mascarar.
  if (total === 0 && r.status !== 0) {
    console.error("tsc falhou sem erros de tipo reconhecíveis:\n" + out.slice(0, 2000));
    process.exit(2);
  }
  return { total, perFile };
}

const current = runTsc();

if (args.has("--update")) {
  const prev = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : null;
  if (prev && current.total > prev.total && !args.has("--force")) {
    console.error(`Recusado: o total subiria de ${prev.total} para ${current.total}. O baseline só pode diminuir.`);
    process.exit(1);
  }
  const sorted = Object.fromEntries(Object.entries(current.perFile).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(baselinePath, JSON.stringify({ total: current.total, files: sorted }, null, 2) + "\n");
  console.log(`Baseline gravado: ${current.total} erros em ${Object.keys(sorted).length} arquivos.`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error("tsc-baseline.json não existe. Rode: npm run typecheck:baseline -- --update");
  process.exit(2);
}

const base = JSON.parse(readFileSync(baselinePath, "utf8"));
const regressions = [];
for (const [file, n] of Object.entries(current.perFile)) {
  const was = base.files[file] || 0;
  if (n > was) regressions.push({ file, was, now: n });
}

if (current.total > base.total || regressions.length) {
  console.error(`✖ Erros de tipo AUMENTARAM: baseline ${base.total} → atual ${current.total}.`);
  for (const r of regressions) console.error(`  ${r.file}: ${r.was} → ${r.now}`);
  console.error("Corrija os erros novos (rode `npm run typecheck` para ver as linhas).");
  process.exit(1);
}

if (current.total < base.total) {
  console.log(`✔ Sem regressão. Erros caíram: ${base.total} → ${current.total}. Rode \`npm run typecheck:baseline -- --update\` para travar o ganho.`);
} else {
  console.log(`✔ Sem regressão (${current.total} erros, igual ao baseline).`);
}
