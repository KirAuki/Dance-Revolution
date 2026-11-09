import argparse
import getpass
import json
import os
import re
import shutil
import sqlite3
from pathlib import Path
from sqlalchemy import select, delete, func
from .app import create_app
from . import db, security
from .validation import DEFAULTS, ROOT, validate_settings, validate_article


def import_sqlite(engine, source, destination):
    source = Path(source).resolve()
    destination = Path(destination).resolve()
    if not source.is_file():
        raise ValueError("SQLite source not found")
    if engine.dialect.name == "sqlite" and Path(engine.url.database).resolve() == source:
        raise ValueError("Source and destination must be different databases")
    # SQLite handles a live WAL consistently; import never writes to the old DB.
    old = sqlite3.connect(source.as_uri() + "?mode=ro", uri=True)
    old.row_factory = sqlite3.Row
    staged = []
    try:
        old.execute("BEGIN")
        tables = {row[0] for row in old.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if "schema_version" in tables:
            version = old.execute("SELECT version FROM schema_version WHERE id=1").fetchone()
            if not version or version[0] != 1:
                raise ValueError("Unsupported source database schema version")
        settings_row = old.execute("SELECT * FROM site_settings WHERE id=1").fetchone()
        if settings_row is None:
            raise ValueError("Source has no site settings")
        settings = validate_settings(json.loads(settings_row["data"]))
        user_rows = [dict(row) for row in old.execute("SELECT id,login,password_hash FROM users")]
        article_rows = [dict(row) for row in old.execute("SELECT * FROM articles")]
        media_rows = [dict(row) for row in old.execute("SELECT * FROM media")]
        # Accept both the former Node database and the current local Python DB.
        application_rows = [dict(row) for row in old.execute("SELECT * FROM applications")] if "applications" in tables else []
        mail_rows = [dict(row) for row in old.execute("SELECT * FROM mail_outbox")] if "mail_outbox" in tables else []
        imports = [(db.users, user_rows), (db.articles, article_rows), (db.media, media_rows),
                   (db.applications, application_rows), (db.outbox, mail_rows)]
        for item in article_rows:
            validate_article({**item, "published": bool(item["published"]), "sections": json.loads(item["sections"])})
        destination.mkdir(parents=True, exist_ok=True)
        for item in media_rows:
            if not re.fullmatch(r"[a-f0-9-]{36}\.(jpg|png|webp|pdf|docx)", item["name"]):
                raise ValueError("Unexpected media filename")
            src, target = source.parent / "uploads" / item["name"], destination / item["name"]
            if not src.is_file():
                raise ValueError("Referenced media file missing: " + item["name"])
            if src.resolve() != target.resolve():
                if target.exists():
                    if src.read_bytes() != target.read_bytes():
                        raise ValueError("Destination media already exists with different content")
                else:
                    shutil.copy2(src, target)
                    staged.append(target)
        with engine.begin() as conn:
            for table, _ in imports:
                if conn.execute(select(func.count()).select_from(table)).scalar_one():
                    raise ValueError("Import requires an empty destination database")
            # No active sessions or rate-limit state are imported.
            conn.execute(delete(db.settings))
            conn.execute(db.settings.insert().values(id=1, data=db.encode(settings), version=settings_row["version"], updated_at=settings_row["updated_at"]))
            for table, rows in imports:
                if rows:
                    conn.execute(table.insert(), rows)
        return {table.name: len(rows) for table, rows in imports}
    except Exception:
        for filename in staged:
            filename.unlink(missing_ok=True)
        raise
    finally:
        old.close()


def main():
    parser = argparse.ArgumentParser(description="Dance Revolution management")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("init-db")
    user = commands.add_parser("admin")
    user.add_argument("--reset", action="store_true")
    legacy = commands.add_parser("import-sqlite")
    legacy.add_argument("source")
    commands.add_parser("send-mail")
    commands.add_parser("retry-mail")
    commands.add_parser("cleanup")
    serve = commands.add_parser("serve")
    serve.add_argument("--port", type=int, default=3000)
    args = parser.parse_args()
    application = create_app()
    engine = application.extensions["db"]
    try:
        if args.command == "init-db":
            db.initialize(engine, DEFAULTS)
            print("Database initialized. Existing records preserved.")
        elif args.command == "admin":
            login = input("Login: ").strip().lower()
            if not re.fullmatch(r"[a-z0-9][a-z0-9._@-]{2,63}", login):
                raise ValueError("Login: 3-64 lowercase Latin letters, digits, . _ @ -")
            password = getpass.getpass("Password (12+ characters): ")
            if password != getpass.getpass("Repeat password: "):
                raise ValueError("Passwords differ")
            encoded = security.password_hash(password)
            with engine.begin() as conn:
                existing = conn.execute(select(db.users.c.id).where(db.users.c.login == login)).scalar_one_or_none()
                if args.reset:
                    if existing is None:
                        raise ValueError("User not found")
                    conn.execute(db.users.update().where(db.users.c.id == existing).values(password_hash=encoded))
                    conn.execute(delete(db.sessions).where(db.sessions.c.user_id == existing))
                else:
                    if existing is not None:
                        raise ValueError("User exists; use --reset")
                    conn.execute(db.users.insert().values(login=login, password_hash=encoded))
            print("Administrator saved.")
        elif args.command == "import-sqlite":
            db.initialize(engine, DEFAULTS)
            print(json.dumps(import_sqlite(engine, args.source, Path(application.config["DATA_DIR"]) / "uploads")))
        elif args.command == "send-mail":
            from .mail import deliver
            print(json.dumps(deliver(engine)))
        elif args.command == "retry-mail":
            with engine.begin() as conn:
                count = conn.execute(db.outbox.update().where(db.outbox.c.status == "failed").values(status="pending", attempts=0, available_at=0)).rowcount
            print(f"Queued again: {count}")
        elif args.command == "cleanup":
            import time
            with engine.begin() as conn:
                conn.execute(delete(db.sessions).where(db.sessions.c.expires_at <= int(time.time())))
                conn.execute(delete(db.limits).where(db.limits.c.expires_at <= int(time.time())))
            print("Expired sessions and rate limits removed.")
        elif args.command == "serve":
            from waitress import serve
            serve(application, host="127.0.0.1", port=args.port, threads=4)
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
