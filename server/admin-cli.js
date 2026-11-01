import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openStore } from "./database.js";
import { hashPassword, normalizeLogin, validLogin } from "./auth.js";

const root = fileURLToPath(new URL("../", import.meta.url));
if (!process.stdin.isTTY)
  throw new Error(
    "Запустите команду в интерактивном терминале. Пароль нельзя передавать аргументом командной строки.",
  );
let hidden = false;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!hidden) process.stdout.write(chunk, encoding);
    callback();
  },
});
const prompt = createInterface({
  input: process.stdin,
  output,
  terminal: true,
});
const passwordQuestion = async (label) => {
  process.stdout.write(label);
  hidden = true;
  try {
    return await prompt.question("");
  } finally {
    hidden = false;
    process.stdout.write("\n");
  }
};
const store = openStore(process.env.DATA_DIR || path.join(root, ".data"), {
  seedDir: path.join(root, "content/news"),
});
try {
  const login = normalizeLogin(
    await prompt.question("Логин (3–64 символа, латиница): "),
  );
  if (!validLogin(login))
    throw new Error("Допустимы латинские буквы, цифры и символы . _ @ -");
  const existing = store.db
    .prepare("SELECT id FROM users WHERE login=?")
    .get(login);
  const reset = process.argv.includes("--reset");
  if (existing && !reset)
    throw new Error(
      "Такой пользователь уже есть. Для смены пароля: npm run admin:password",
    );
  if (!existing && reset) throw new Error("Пользователь не найден.");
  const password = await passwordQuestion(
    "Пароль (минимум 12 символов, ввод скрыт): ",
  );
  const repeated = await passwordQuestion("Повторите пароль: ");
  if (password !== repeated) throw new Error("Пароли не совпадают.");
  const hash = await hashPassword(password);
  store.db.exec("BEGIN IMMEDIATE");
  try {
    if (existing) {
      store.db
        .prepare("UPDATE users SET password_hash=? WHERE id=?")
        .run(hash, existing.id);
      store.db.prepare("DELETE FROM sessions WHERE user_id=?").run(existing.id);
    } else
      store.db
        .prepare("INSERT INTO users (login,password_hash) VALUES (?,?)")
        .run(login, hash);
    store.db.exec("COMMIT");
  } catch (error) {
    store.db.exec("ROLLBACK");
    throw error;
  }
  console.log(
    existing
      ? "Пароль изменён. Прежние сессии закрыты."
      : "Администратор создан. Войдите на /admin/.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  prompt.close();
  store.close();
}
