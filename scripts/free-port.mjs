#!/usr/bin/env node
/**
 * free-port.mjs — libera uma ou mais portas TCP encerrando quem as escuta.
 * Cross-platform (Windows/macOS/Linux), sem dependências externas.
 *
 * Uso: node scripts/free-port.mjs 3001 5175
 */
import { execSync } from "node:child_process";

const ports = process.argv.slice(2).map(Number).filter(Boolean);
const isWin = process.platform === "win32";

if (ports.length === 0) {
  console.log("[free-port] nenhuma porta informada. Ex.: node scripts/free-port.mjs 3001 5175");
  process.exit(0);
}

function pidsOnPort(port) {
  const set = new Set();
  try {
    if (isWin) {
      const out = execSync("netstat -ano -p tcp", { encoding: "utf8" });
      for (const line of out.split(/\r?\n/)) {
        const m = line.match(/:(\d+)\s+\S+\s+LISTENING\s+(\d+)/i);
        if (m && Number(m[1]) === port) set.add(m[2]);
      }
    } else {
      const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: "utf8" });
      out.split(/\s+/).filter(Boolean).forEach((p) => set.add(p));
    }
  } catch {
    // lsof/netstat sem resultado => porta livre
  }
  return [...set];
}

for (const port of ports) {
  const pids = pidsOnPort(port);
  if (pids.length === 0) {
    console.log(`[free-port] porta ${port} já está livre`);
    continue;
  }
  for (const pid of pids) {
    try {
      execSync(isWin ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`, { stdio: "ignore" });
      console.log(`[free-port] porta ${port}: encerrei o PID ${pid}`);
    } catch (err) {
      console.log(`[free-port] porta ${port}: falha ao encerrar PID ${pid} — ${err.message}`);
    }
  }
}
