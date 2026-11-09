import { createServer } from "vite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import { pythonExecutable, root } from "../scripts/python.mjs";

export default async function setup() {
  const dataDir = await mkdtemp(path.join(tmpdir(), "dance-browser-test-"));
  const socket=net.createServer();socket.listen(0,"127.0.0.1");await once(socket,"listening");
  const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
  const previous=process.env.API_ORIGIN;
  process.env.API_ORIGIN=`http://127.0.0.1:${port}`;
  const child=spawn(pythonExecutable(),["-m","tests.serve_browser"],{cwd:root,env:{...process.env,BROWSER_TEST_DATA_DIR:dataDir,BROWSER_TEST_PORT:String(port)},stdio:["ignore","pipe","pipe"],windowsHide:true});
  let startupError="";child.stderr.on("data",data=>{startupError+=data.toString();});
  child.on("error",error=>{startupError+=error.message;});
  let server;
  async function cleanup(){
    await server?.close();
    if(child.exitCode===null){const exited=once(child,"exit");child.kill();await exited;}
    if(previous===undefined)delete process.env.API_ORIGIN;else process.env.API_ORIGIN=previous;
    if(path.dirname(path.resolve(dataDir))!==path.resolve(tmpdir())||!path.basename(dataDir).startsWith("dance-browser-test-"))throw new Error("Unexpected test directory");
    await rm(dataDir,{recursive:true,force:true});
  }
  try {
    for(let attempt=0;;attempt++){
      try {if((await fetch(process.env.API_ORIGIN+"/health")).ok)break;}catch{}
      if(child.exitCode!==null || attempt>=200)throw new Error("Python test backend failed: "+startupError);
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    server=await createServer({server:{host:"127.0.0.1",port:4173,strictPort:true}});await server.listen();
    return cleanup;
  }catch(error){await cleanup();throw error;}
}
