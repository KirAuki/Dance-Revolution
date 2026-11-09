import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export function pythonExecutable() {
  if (process.env.PYTHON) return process.env.PYTHON;
  const candidates = process.platform === "win32"
    ? [".venv/Scripts/python.exe", ".qa/python/python.exe"] : [".venv/bin/python"];
  return candidates.map(name=>path.join(root,name)).find(existsSync) || (process.platform === "win32" ? "python" : "python3");
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const child = spawn(pythonExecutable(), process.argv.slice(2), {cwd:root,stdio:"inherit",env:process.env,windowsHide:true});
  child.on("error", error => { console.error(`Не удалось запустить Python: ${error.message}. Создайте .venv или задайте PYTHON.`); process.exitCode=1; });
  child.on("exit", code=>{ process.exitCode=code ?? 1; });
  for (const signal of ["SIGINT","SIGTERM"]) process.on(signal,()=>child.kill(signal));
}
