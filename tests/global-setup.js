import { createServer } from "vite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { openStore } from "../server/database.js";
import { hashPassword } from "../server/auth.js";
import { adminCredentials } from "./fixtures.js";

export default async function setup() {
  const dataDir = await mkdtemp(path.join(tmpdir(), "dance-browser-test-"));
  const previousDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = dataDir;
  const store = openStore(dataDir, { seedDir: path.resolve("content/news") });
  store.db
    .prepare("INSERT INTO users (login,password_hash) VALUES (?,?)")
    .run(adminCredentials.login, await hashPassword(adminCredentials.password));
  store.close();
  // Own the server in-process so teardown also works in restricted Windows shells.
  const server = await createServer({
    server: { host: "127.0.0.1", port: 4173, strictPort: true },
  });
  await server.listen();
  return async () => {
    await server.close();
    if (previousDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previousDataDir;
    if (
      path.dirname(path.resolve(dataDir)) !== path.resolve(tmpdir()) ||
      !path.basename(dataDir).startsWith("dance-browser-test-")
    )
      throw new Error("Unexpected test directory.");
    await rm(dataDir, { recursive: true, force: true });
  };
}
