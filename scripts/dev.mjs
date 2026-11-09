import { spawn } from "node:child_process";
import { createServer } from "vite";
import { pythonExecutable, root } from "./python.mjs";

const port = Number(process.env.PYTHON_PORT || 3000);
process.env.API_ORIGIN = `http://127.0.0.1:${port}`;
const child = spawn(pythonExecutable(), ["-m","backend.cli","serve","--port",String(port)], {cwd:root,stdio:"inherit",windowsHide:true});
let server;
let stopping = false;
async function stop(code=0) {
  if(stopping)return;
  stopping=true;
  await server?.close(); child.kill(); process.exitCode=code;
}
child.on("error", error=>{console.error(error.message);stop(1);});
child.on("exit", code=>{if(!stopping)stop(code || 1);});
for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>stop());
try {
  for(let attempt=0;;attempt++) {
    if(stopping)throw new Error("Python не запущен.");
    try {const r=await fetch(process.env.API_ORIGIN+"/health");if(r.ok)break;}catch{}
    if(attempt>=40)throw new Error("API не готов. Выполните npm run db:init или npm run db:import -- .data/site.sqlite.");
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  server=await createServer({server:{host:"127.0.0.1"}});await server.listen();server.printUrls();
}catch(error){console.error(error.message);await stop(1);}
