import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { validateArticles } from "../shared/news.js";
import { defaultSiteSettings } from "../shared/site-settings.js";

const decode = (row) =>
  row && {
    ...row,
    published: Boolean(row.published),
    sections: JSON.parse(row.sections),
  };
export const cardFields =
  "id, slug, title, description, category, date, image, published, version, updated_at";

export function openStore(dataDir, { seedDir } = {}) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(dataDir, "site.sqlite"));
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
  );
  const version = db.prepare("PRAGMA user_version").get().user_version;
  if (version > 2) {
    db.close();
    throw new Error("Database was created by a newer server version.");
  }
  if (version === 0) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(`
        CREATE TABLE users (id INTEGER PRIMARY KEY, login TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL);
        CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf TEXT NOT NULL, expires_at INTEGER NOT NULL);
        CREATE INDEX sessions_expiry ON sessions(expires_at);
        CREATE TABLE login_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
        CREATE TABLE articles (
          id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, description TEXT NOT NULL,
          category TEXT NOT NULL, date TEXT NOT NULL, image TEXT NOT NULL DEFAULT '', sections TEXT NOT NULL,
          published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)), version INTEGER NOT NULL DEFAULT 1,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX articles_public_date ON articles(published, date DESC);
        CREATE TABLE media (name TEXT PRIMARY KEY, mime TEXT NOT NULL, size INTEGER NOT NULL, created_at TEXT NOT NULL);
      `);
      if (seedDir) {
        const files = readdirSync(seedDir).filter((name) =>
          name.endsWith(".json"),
        );
        const articles = validateArticles(
          files.map((name) =>
            JSON.parse(readFileSync(path.join(seedDir, name), "utf8")),
          ),
        );
        const insert = db.prepare(
          "INSERT INTO articles (id,slug,title,description,category,date,image,sections,published,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        );
        for (const item of articles)
          insert.run(
            randomUUID(),
            item.slug,
            item.title,
            item.description,
            item.category,
            item.date,
            item.image || "",
            JSON.stringify(item.sections),
            Number(item.published),
            new Date().toISOString(),
          );
      }
      db.exec("PRAGMA user_version=1; COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      db.close();
      throw error;
    }
  }
  if (version < 2) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec("CREATE TABLE site_settings (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL)");
      db.prepare("INSERT INTO site_settings (id,data,updated_at) VALUES (1,?,?)")
        .run(JSON.stringify(defaultSiteSettings), new Date().toISOString());
      db.exec("PRAGMA user_version=2; COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      db.close();
      throw error;
    }
  }
  return {
    db,
    dataDir,
    close() {
      db.close();
    },
    settings() {
      const row = db.prepare("SELECT data,version,updated_at FROM site_settings WHERE id=1").get();
      const settings = JSON.parse(row.data);
      // Supply new editable sections without resetting existing site content.
      settings.pages ??= structuredClone(defaultSiteSettings.pages);
      settings.news ??= structuredClone(defaultSiteSettings.news);
      // One contact email; optional social links can be added to older records.
      for (const key of ["instagramUrl", "vkUrl", "whatsappUrl"]) settings.contacts[key] ??= "";
      for (const key of ["tracksEmail", "telegramLabel", "maxLabel"]) delete settings.contacts[key];
      return { settings, version: row.version, updatedAt: row.updated_at };
    },
    saveSettings(settings, version) {
      const result = db.prepare("UPDATE site_settings SET data=?,version=version+1,updated_at=? WHERE id=1 AND version=?")
        .run(JSON.stringify(settings), new Date().toISOString(), version);
      return result.changes ? this.settings() : null;
    },
    article(id) {
      return decode(db.prepare("SELECT * FROM articles WHERE id=?").get(id));
    },
    published(slug) {
      return decode(
        db
          .prepare("SELECT * FROM articles WHERE slug=? AND published=1")
          .get(slug),
      );
    },
    cards({ publicOnly = false, limit = 1000, offset = 0 } = {}) {
      return db
        .prepare(
          `SELECT ${cardFields} FROM articles ${publicOnly ? "WHERE published=1" : ""} ORDER BY date DESC, updated_at DESC, id LIMIT ? OFFSET ?`,
        )
        .all(limit, offset)
        .map((row) => ({ ...row, published: Boolean(row.published) }));
    },
    save(article, id, expectedVersion) {
      const values = [
        article.title,
        article.description,
        article.category,
        article.date,
        article.image || "",
        JSON.stringify(article.sections),
        Number(article.published),
        new Date().toISOString(),
      ];
      if (id) {
        const result = db
          .prepare(
            "UPDATE articles SET title=?,description=?,category=?,date=?,image=?,sections=?,published=?,updated_at=?,version=version+1 WHERE id=? AND version=?",
          )
          .run(...values, id, expectedVersion);
        return result.changes ? this.article(id) : null;
      }
      id = randomUUID();
      db.prepare(
        "INSERT INTO articles (title,description,category,date,image,sections,published,updated_at,id,slug) VALUES (?,?,?,?,?,?,?,?,?,?)",
      ).run(...values, id, article.slug);
      return this.article(id);
    },
  };
}
