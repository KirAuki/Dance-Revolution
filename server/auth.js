import {
  randomBytes,
  createHash,
  scrypt as deriveKey,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(deriveKey);
const options = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const sessionLifetime = 8 * 60 * 60 * 1000;
export const normalizeLogin = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";
export const validLogin = (value) => /^[a-z0-9][a-z0-9._@-]{2,63}$/.test(value);
export const tokenHash = (value) =>
  createHash("sha256").update(value).digest("hex");

export async function hashPassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 256
  )
    throw new Error("Пароль должен содержать от 12 до 256 символов.");
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64, options);
  return `scrypt:${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password, encoded) {
  const parts = typeof encoded === "string" ? encoded.split(":") : [];
  const valid =
    parts.length === 3 &&
    parts[0] === "scrypt" &&
    /^[a-f0-9]{32}$/.test(parts[1]) &&
    /^[a-f0-9]{128}$/.test(parts[2]);
  // Unknown users perform the same derivation to avoid an account enumeration shortcut.
  const salt = valid ? parts[1] : "0".repeat(32);
  const expected = Buffer.from(valid ? parts[2] : "0".repeat(128), "hex");
  const actual = await scrypt(password, salt, 64, options);
  return timingSafeEqual(actual, expected) && valid;
}

export function createAuth(store, { secure = false, now = Date.now } = {}) {
  const { db } = store;
  const cookieName = secure ? "__Host-dance_admin" : "dance_admin";
  const cookie = (token, seconds) =>
    `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secure ? "; Secure" : ""}`;
  const readToken = (request) =>
    request.headers.cookie
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
  return {
    session(request) {
      const token = readToken(request);
      if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
      return (
        db
          .prepare(
            "SELECT sessions.*, users.login FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?",
          )
          .get(tokenHash(token), now()) || null
      );
    },
    start(userId, response) {
      const token = randomBytes(32).toString("hex");
      const csrf = randomBytes(32).toString("hex");
      db.prepare("DELETE FROM sessions WHERE expires_at<=?").run(now());
      db.prepare("INSERT INTO sessions VALUES (?,?,?,?)").run(
        tokenHash(token),
        userId,
        csrf,
        now() + sessionLifetime,
      );
      response.setHeader("Set-Cookie", cookie(token, sessionLifetime / 1000));
      return csrf;
    },
    end(request, response) {
      const token = readToken(request);
      if (token)
        db.prepare("DELETE FROM sessions WHERE token_hash=?").run(
          tokenHash(token),
        );
      response.setHeader("Set-Cookie", cookie("", 0));
    },
    allowAttempt(login, ip) {
      const time = now();
      db.prepare("DELETE FROM login_limits WHERE expires_at<=?").run(time);
      const keys = [`login:${tokenHash(login)}`, `ip:${tokenHash(ip)}`];
      for (const key of keys) {
        const limit = db
          .prepare("SELECT count,expires_at FROM login_limits WHERE key=?")
          .get(key);
        if (limit?.count >= 10)
          return Math.ceil((limit.expires_at - time) / 1000);
      }
      for (const key of keys)
        db.prepare(
          "INSERT INTO login_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1",
        ).run(key, time + 15 * 60000);
      return 0;
    },
    resetAttempts(login, ip) {
      db.prepare("DELETE FROM login_limits WHERE key IN (?,?)").run(
        `login:${tokenHash(login)}`,
        `ip:${tokenHash(ip)}`,
      );
    },
  };
}
