import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function json(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(data));
}
export async function readBody(request, limit = 262144) {
  if (Number(request.headers["content-length"]) > limit)
    throw new HttpError(413, "Слишком большой запрос.");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, "Слишком большой запрос.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export async function readJson(request, limit) {
  if (request.headers["content-type"]?.split(";")[0] !== "application/json")
    throw new HttpError(415, "Ожидается JSON.");
  try {
    const value = JSON.parse((await readBody(request, limit)).toString("utf8"));
    if (!value || Array.isArray(value) || typeof value !== "object")
      throw new Error();
    return value;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Некорректный формат запроса.");
  }
}
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".ico": "image/x-icon",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
export async function sendFile(
  request,
  response,
  filename,
  { cache = "public, max-age=3600", mime } = {},
) {
  let info;
  try {
    info = await stat(filename);
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
  if (!info.isFile()) return false;
  response.setHeader(
    "Content-Type",
    mime ||
      types[path.extname(filename).toLowerCase()] ||
      "application/octet-stream",
  );
  response.setHeader("Cache-Control", cache);
  response.setHeader("Accept-Ranges", "bytes");
  const etag = `W/"${info.size}-${info.mtimeMs}"`;
  response.setHeader("ETag", etag);
  if (request.headers["if-none-match"] === etag) {
    response.statusCode = 304;
    response.end();
    return true;
  }
  let start = 0,
    end = info.size - 1;
  if (request.headers.range && request.method === "GET") {
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
    if (range && (range[1] || range[2])) {
      start = range[1]
        ? Number(range[1])
        : Math.max(0, info.size - Number(range[2]));
      end = range[1] && range[2] ? Math.min(Number(range[2]), end) : end;
    } else start = info.size;
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start > end ||
      start >= info.size
    ) {
      response.writeHead(416, { "Content-Range": `bytes */${info.size}` });
      response.end();
      return true;
    }
    response.statusCode = 206;
    response.setHeader("Content-Range", `bytes ${start}-${end}/${info.size}`);
  }
  response.setHeader("Content-Length", Math.max(0, end - start + 1));
  if (request.method === "HEAD" || !info.size) {
    response.end();
    return true;
  }
  const stream = createReadStream(filename, { start, end });
  stream.on("error", () => response.destroy());
  response.once("close", () => stream.destroy());
  stream.pipe(response);
  return true;
}
