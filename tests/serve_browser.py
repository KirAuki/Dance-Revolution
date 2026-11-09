"""Isolated backend owned by Playwright; never creates real admin accounts."""
import os
import json
import uuid
from pathlib import Path
from waitress import serve
from backend.app import create_app
from backend import db, security
from backend.validation import DEFAULTS, ROOT

data_dir = Path(os.environ["BROWSER_TEST_DATA_DIR"]).resolve()
assert data_dir.name.startswith("dance-browser-test-")
app = create_app({"DATA_DIR": data_dir, "DATABASE_URL": "sqlite:///" + (data_dir / "test.sqlite").as_posix(), "PRODUCTION": False, "SITE_URL": ""})
engine = app.extensions["db"]
db.initialize(engine, DEFAULTS)
with engine.begin() as conn:
    conn.execute(db.users.insert().values(login="qa-editor", password_hash=security.password_hash("Local-test-only-not-a-real-account-2027")))
    for filename in (ROOT / "content" / "news").glob("*.json"):
        item = json.loads(filename.read_text(encoding="utf-8"))
        item["sections"] = db.encode(item["sections"])
        conn.execute(db.articles.insert().values(id=str(uuid.uuid4()), version=1, updated_at=db.timestamp(), **item))
try:
    serve(app, host="127.0.0.1", port=int(os.environ["BROWSER_TEST_PORT"]), threads=4)
finally:
    engine.dispose()
