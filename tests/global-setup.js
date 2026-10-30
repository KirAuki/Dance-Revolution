import { createServer } from "vite";

export default async function setup() {
  // Own the server in-process so teardown also works in restricted Windows shells.
  const server = await createServer({
    server: { host: "127.0.0.1", port: 4173, strictPort: true },
  });
  await server.listen();
  return () => server.close();
}
