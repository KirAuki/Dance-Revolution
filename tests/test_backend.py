import copy
import json
import sqlite3
import uuid
import os
from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import select, func
from backend.app import create_app
from backend import db, security
from backend.validation import DEFAULTS, validate_settings, validate_application, Problem
from backend.mail import deliver


@pytest.fixture
def app(tmp_path, monkeypatch):
    for key in ["SITE_URL", "DATABASE_URL", "MYSQL_DATABASE", "APP_ENV"]:
        monkeypatch.delenv(key, raising=False)
    test_url = os.environ.get("TEST_MYSQL_URL")
    if test_url:
        from sqlalchemy.engine import make_url
        parsed = make_url(test_url)
        assert parsed.host == "127.0.0.1" and parsed.port == 3308 and parsed.database.startswith("dance_test_")
    app = create_app({"TESTING": True, "PRODUCTION": False, "SITE_URL": "http://localhost", "DATA_DIR": tmp_path,
                      "DATABASE_URL": test_url or "sqlite:///" + (tmp_path / "test.sqlite").as_posix()})
    engine = app.extensions["db"]
    db.initialize(engine, DEFAULTS)
    with engine.begin() as conn:
        conn.execute(db.users.insert().values(login="editor", password_hash=security.password_hash("Test-password-2027!")))
    yield app
    if test_url:
        db.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def auth(client):
    headers = {"Origin": "http://localhost", "X-Admin-Request": "1"}
    response = client.post("/api/admin/login", json={"login": "editor", "password": "Test-password-2027!"}, headers=headers)
    assert response.status_code == 200
    assert "HttpOnly" in response.headers["Set-Cookie"]
    return {**headers, "X-CSRF-Token": response.json["csrf"]}


def valid_form():
    home = DEFAULTS["home"]
    return {"collective": "Тестовый коллектив", "performanceTitle": "Весна", "participantCount": "5", "duration": "04:00",
            "nomination": home["nominations"]["items"][0]["title"], "ageCategory": home["categories"]["ages"][0]["title"],
            "professionalLevel": home["categories"]["levels"][0]["title"], "participants": "Участник 1\nУчастник 2", "institution": "", "country": "Россия", "city": "Москва", "director": "Руководитель", "teacher": "Педагог", "accommodation": "Нет", "hotelGuests": "", "email": "test@example.com", "phone": "+7 999 000-00-00", "telegram": "", "comment": "", "website": "", "regulationsAccepted": True, "personalDataAccepted": True}


def submit(client, data=None, key=None):
    return client.post("/api/application", json=data or valid_form(), headers={"Idempotency-Key": key or str(uuid.uuid4())})


def test_application_persists_without_smtp_and_retries_are_idempotent(app, client):
    key = str(uuid.uuid4())
    first = submit(client, key=key)
    assert first.status_code == 201
    second = submit(client, key=key)
    assert second.status_code == 200
    assert first.json["applicationNumber"] == second.json["applicationNumber"]
    with app.extensions["db"].connect() as conn:
        assert conn.execute(select(func.count()).select_from(db.applications)).scalar_one() == 1
        assert conn.execute(select(func.count()).select_from(db.outbox)).scalar_one() == 2
        row = conn.execute(select(db.applications)).mappings().one()
        assert json.loads(row["data"])["personalDataAccepted"] is True
        assert json.loads(row["event_snapshot"])["consent"]["sections"]
    assert submit(client, {**valid_form(), "collective": "Изменено"}, key).status_code == 409
    assert client.get("/api/admin/applications").status_code == 401
    assert client.get("/api/admin/applications/export").status_code == 401


def test_concurrent_retry_creates_one_application(app):
    key = str(uuid.uuid4())
    def send(_):
        with app.test_client() as client:
            return submit(client, key=key)
    with ThreadPoolExecutor(max_workers=4) as pool:
        responses = list(pool.map(send, range(4)))
    assert all(r.status_code in (200, 201) for r in responses)
    assert len({r.json["applicationNumber"] for r in responses}) == 1
    with app.extensions["db"].connect() as conn:
        assert conn.execute(select(func.count()).select_from(db.outbox)).scalar_one() == 2


def test_application_status_conflicts_search_export_and_csrf(app, client, auth):
    data = {**valid_form(), "collective": '=HYPERLINK("https://example.com")'}
    assert submit(client, data).status_code == 201
    listing = client.get("/api/admin/applications?status=new&search=HYPERLINK").json
    assert listing["total"] == 1
    identity = listing["applications"][0]["id"]
    path = "/api/admin/applications/" + identity
    item = client.get(path).json["application"]
    assert "idempotency_key" not in item
    change = {"version": item["version"], "status": "confirmed", "notes": "Связались с руководителем"}
    assert client.put(path, json=change).status_code == 403
    result = client.put(path, json=change, headers=auth)
    assert result.status_code == 200
    assert result.json["application"]["notes"] == change["notes"]
    assert client.put(path, json=change, headers=auth).status_code == 409
    assert client.get("/api/admin/applications?status=new").json["total"] == 0
    assert client.get("/api/admin/applications?search=%25").json["total"] == 0
    exported = client.get("/api/admin/applications/export")
    assert exported.status_code == 200 and "attachment" in exported.headers["Content-Disposition"]
    assert "'=HYPERLINK" in exported.get_data(as_text=True)


def test_dynamic_form_rules_and_validation(app, client, auth):
    record = client.get("/api/admin/settings").json
    record["settings"]["home"]["registration"]["minParticipants"] = 8
    record["settings"]["home"]["nominations"]["items"][0]["title"] = "Новая номинация"
    assert client.put("/api/admin/settings", json=record, headers=auth).status_code == 200
    assert submit(client).status_code == 422
    assert submit(client, {**valid_form(), "participantCount": 8, "nomination": "Новая номинация"}).status_code == 201
    for key, value in [("email", "bad\r\nBcc: x@example.com"), ("personalDataAccepted", "true"), ("duration", "99:99"), ("participantCount", True), ("collective", ["test"])]:
        assert submit(client, {**valid_form(), key: value}).status_code == 422
    assert client.post("/api/application", json=valid_form()).status_code == 400


def test_settings_and_news_require_auth_escape_html_and_reject_stale_edits(client, auth):
    record = client.get("/api/admin/settings").json
    record["settings"]["pages"]["privacy"]["title"] = '<script>alert(1)</script>'
    assert client.put("/api/admin/settings", json=record, headers=auth).status_code == 200
    assert client.put("/api/admin/settings", json=record, headers=auth).status_code == 409
    response = client.get("/privacy")
    assert response.status_code == 200
    assert "&lt;script&gt;" in response.get_data(as_text=True)
    assert "<script>alert(1)" not in response.get_data(as_text=True)
    assert client.get("/privacy.html").status_code == 301
    item = {"slug": "test-news", "title": "Публикация", "description": "Описание", "category": "Новости", "date": "2027-01-01", "image": "", "published": False, "sections": [{"heading": "Раздел", "paragraphs": ['<img src=x onerror=alert(1)>']} ]}
    response = client.post("/api/admin/articles", json=item, headers=auth)
    assert response.status_code == 201
    saved = response.json["article"]
    assert client.get("/news/test-news").status_code == 404
    assert "test-news" not in client.get("/sitemap.xml").get_data(as_text=True)
    assert client.put("/api/admin/articles/" + saved["id"], json={**saved, "published": True}, headers=auth).status_code == 200
    html = client.get("/news/test-news").get_data(as_text=True)
    assert "&lt;img" in html and 'type="application/ld+json"' in html
    assert "test-news" in client.get("/sitemap.xml").get_data(as_text=True)
    assert client.delete("/api/admin/articles/" + saved["id"], json={"version": 1}, headers=auth).status_code == 409


def test_media_remain_private_until_used_and_path_traversal_is_denied(app, client, auth):
    from PIL import Image
    import io
    image = io.BytesIO()
    Image.new("RGB", (20, 20), "green").save(image, format="PNG")
    response = client.post("/api/admin/media", data=image.getvalue(), headers={**auth, "Content-Type": "image/png"})
    assert response.status_code == 201
    path = response.json["url"]
    public = app.test_client()
    assert public.get(path).status_code == 404
    record = client.get("/api/admin/settings").json
    record["settings"]["home"]["hero"]["poster"] = path
    assert client.put("/api/admin/settings", json=record, headers=auth).status_code == 200
    assert public.get(path).status_code == 200
    assert public.get("/assets/../../.env.local").status_code == 404
    assert client.post("/api/admin/media", data=b"<svg onload=alert(1)>", headers=auth).status_code == 415


def test_mail_failure_does_not_lose_application_and_can_retry(app, client):
    submit(client)
    def fail(_):
        raise OSError("private details must not be logged")
    result = deliver(app.extensions["db"], send=fail)
    assert result["failed"] == 2
    with app.extensions["db"].begin() as conn:
        assert conn.execute(select(func.count()).select_from(db.applications)).scalar_one() == 1
        rows = conn.execute(select(db.outbox)).mappings().all()
        assert all(row["status"] == "retry" and row["last_error"] == "OSError" for row in rows)
        conn.execute(db.outbox.update().values(available_at=0))
    messages = []
    assert deliver(app.extensions["db"], send=messages.append)["sent"] == 2
    assert deliver(app.extensions["db"], send=messages.append)["sent"] == 0


def test_rate_limit_and_logout(client, auth):
    for _ in range(10):
        assert submit(client).status_code == 201
    assert submit(client).status_code == 429
    assert client.post("/api/admin/logout", headers=auth).status_code == 200
    assert client.get("/api/admin/settings").status_code == 401


def test_home_schema_defaults_round_trip():
    assert validate_settings(DEFAULTS) == DEFAULTS
    invalid = copy.deepcopy(DEFAULTS)
    invalid["home"]["hero"]["poster"] = "javascript:alert(1)"
    with pytest.raises(Problem):
        validate_settings(invalid)
    for values in [{}, {**DEFAULTS, "contacts": "invalid"}, {**DEFAULTS, "pages": []}, {**DEFAULTS, "home": {"hero": None}}]:
        with pytest.raises(Problem):
            validate_settings(values)


def test_legacy_import_preserves_content_accounts_and_files(app, tmp_path):
    from backend.cli import import_sqlite
    source_dir = tmp_path / "legacy"
    source_dir.mkdir()
    (source_dir / "uploads").mkdir()
    name = str(uuid.uuid4()) + ".png"
    (source_dir / "uploads" / name).write_bytes(b"existing image bytes")
    settings = copy.deepcopy(DEFAULTS)
    settings.pop("home")
    settings["contacts"]["email"] = "existing@example.com"
    old = sqlite3.connect(source_dir / "site.sqlite")
    old.executescript("CREATE TABLE users(id INTEGER PRIMARY KEY,login TEXT,password_hash TEXT); CREATE TABLE site_settings(id INTEGER PRIMARY KEY,data TEXT,version INTEGER,updated_at TEXT); CREATE TABLE articles(id TEXT PRIMARY KEY,slug TEXT,title TEXT,description TEXT,category TEXT,date TEXT,image TEXT,sections TEXT,published INTEGER,version INTEGER,updated_at TEXT); CREATE TABLE media(name TEXT PRIMARY KEY,mime TEXT,size INTEGER,created_at TEXT);")
    encoded = security.password_hash("Existing-admin-password")
    old.execute("INSERT INTO users VALUES(7,?,?)", ("existing-editor", encoded))
    old.execute("INSERT INTO site_settings VALUES(1,?,9,?)", (db.encode(settings), db.timestamp()))
    old.execute("INSERT INTO media VALUES(?,?,?,?)", (name, "image/png", 20, db.timestamp()))
    old.execute("INSERT INTO articles VALUES(?,?,?,?,?,?,?,?,?,?,?)", (str(uuid.uuid4()), "saved-story", "Сохранённая статья", "Описание", "Новости", "2027-01-01", "/media/" + name, db.encode([{"heading":"","paragraphs":["Текст статьи"]}]), 1, 5, db.timestamp()))
    old.commit()
    old.close()
    engine = app.extensions["db"]
    with engine.begin() as conn:
        conn.execute(db.users.delete())
    copied = import_sqlite(engine, source_dir / "site.sqlite", tmp_path / "uploads")
    assert copied == {"users": 1, "articles": 1, "media": 1, "applications": 0, "mail_outbox": 0}
    assert (tmp_path / "uploads" / name).read_bytes() == b"existing image bytes"
    with engine.connect() as conn:
        row = conn.execute(select(db.settings)).mappings().one()
        assert row["version"] == 9
        assert json.loads(row["data"])["contacts"]["email"] == "existing@example.com"
        assert conn.execute(select(db.articles.c.version)).scalar_one() == 5
        user = conn.execute(select(db.users)).mappings().one()
        assert user["id"] == 7 and security.verify_password("Existing-admin-password", user["password_hash"])
    with pytest.raises(ValueError, match="empty destination"):
        import_sqlite(engine, source_dir / "site.sqlite", tmp_path / "uploads")


def test_current_sqlite_import_preserves_applications_and_mail(app, tmp_path):
    from backend.cli import import_sqlite
    source_dir = tmp_path / "current"
    source = create_app({"PRODUCTION": False, "SITE_URL": "http://localhost", "DATA_DIR": source_dir,
                         "DATABASE_URL": "sqlite:///" + (source_dir / "site-python.sqlite").as_posix()})
    source_engine = source.extensions["db"]
    try:
        db.initialize(source_engine, DEFAULTS)
        source_client = source.test_client()
        number = submit(source_client).json["applicationNumber"]
        with source_engine.begin() as conn:
            conn.execute(db.applications.update().values(status="confirmed", notes="Согласована программа", version=3))
            message_id = conn.execute(select(db.outbox.c.id).limit(1)).scalar_one()
            conn.execute(db.outbox.update().where(db.outbox.c.id == message_id).values(status="sent", attempts=1))
        engine = app.extensions["db"]
        with engine.begin() as conn:
            conn.execute(db.users.delete())
        copied = import_sqlite(engine, source_dir / "site-python.sqlite", tmp_path / "uploads")
        assert copied["applications"] == 1 and copied["mail_outbox"] == 2
        for table in (db.applications, db.outbox):
            with source_engine.connect() as before, engine.connect() as after:
                original = [dict(row) for row in before.execute(select(table).order_by(table.c.id)).mappings()]
                actual = [dict(row) for row in after.execute(select(table).order_by(table.c.id)).mappings()]
                assert actual == original
        assert number.startswith("TR-")
    finally:
        source_engine.dispose()


def test_interrupted_final_mail_attempt_can_be_recovered(app, client):
    submit(client)
    engine = app.extensions["db"]
    with engine.begin() as conn:
        conn.execute(db.outbox.update().values(status="sending", attempts=8, lease_until=0))
    assert deliver(engine, send=lambda message: pytest.fail("Do not resend an exhausted message"))["sent"] == 0
    with engine.connect() as conn:
        rows = conn.execute(select(db.outbox.c.status, db.outbox.c.last_error)).all()
        assert rows == [("failed", "InterruptedDelivery"), ("failed", "InterruptedDelivery")]


def test_production_rejects_sqlite_and_invalid_origin(tmp_path):
    with pytest.raises(RuntimeError, match="Production requires MySQL"):
        create_app({"PRODUCTION":True,"SITE_URL":"https://example.com","DATABASE_URL":"sqlite:///test.sqlite","DATA_DIR":tmp_path})
    with pytest.raises(RuntimeError, match="SITE_URL"):
        create_app({"PRODUCTION":True,"SITE_URL":"http://example.com","DATABASE_URL":"mysql+pymysql://user:pass@localhost/db","DATA_DIR":tmp_path})


def test_passenger_activates_venv_even_when_executable_points_to_same_binary(tmp_path, monkeypatch):
    import runpy
    import sys
    from pathlib import Path
    import backend.app
    from backend.validation import ROOT
    interpreter = tmp_path / "dance-venv" / "bin" / "python"
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    monkeypatch.setattr(sys, "executable", str(interpreter))
    monkeypatch.setattr(sys, "prefix", str(tmp_path / "system-python"))
    calls = []
    def reexecute(*args):
        calls.append(args)
        raise RuntimeError("restart in venv")
    monkeypatch.setattr(os, "execl", reexecute)
    with pytest.raises(RuntimeError, match="restart in venv"):
        runpy.run_path(str(ROOT / "deploy" / "host0" / "passenger_wsgi.py"))
    assert calls[0][:2] == (str(interpreter), str(interpreter))
    monkeypatch.setattr(sys, "prefix", str(interpreter.parent.parent))
    monkeypatch.setattr(sys, "path", sys.path.copy())
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("PUBLIC_DIR", str(tmp_path / "public"))
    marker = object()
    monkeypatch.setattr(backend.app, "create_app", lambda: marker)
    assert runpy.run_path(str(ROOT / "deploy" / "host0" / "passenger_wsgi.py"))["application"] is marker
    assert len(calls) == 1
