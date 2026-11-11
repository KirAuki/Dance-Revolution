import copy
import json
import sqlite3
import uuid
import os
import re
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


def test_delete_application_checks_access_version_and_removes_only_related_mail(app, client, auth):
    for _ in range(2):
        assert submit(client).status_code == 201
    records = client.get("/api/admin/applications").json["applications"]
    target, other = records
    path = "/api/admin/applications/" + target["id"]
    version = {"version": target["version"]}
    assert app.test_client().delete(path, json=version, headers=auth).status_code == 401
    assert client.delete(path, json=version).status_code == 403
    assert client.delete(path, json={"version": True}, headers=auth).status_code == 422
    assert client.delete(path, json={"version": 0}, headers=auth).status_code == 422
    assert client.delete(path, json={"version": 10**100}, headers=auth).status_code == 422
    assert client.delete(path, json={"version": 99}, headers=auth).status_code == 409
    saved = client.put(path, json={**version, "status": "archived", "notes": "Keep until reviewed"}, headers=auth)
    assert saved.status_code == 200
    assert client.delete(path, json=version, headers=auth).status_code == 409
    assert client.get(path).json["application"]["notes"] == "Keep until reviewed"
    version = {"version": saved.json["application"]["version"]}
    with app.extensions["db"].begin() as conn:
        # Sent mail bodies must also be erased from the database.
        conn.execute(db.outbox.update().where(db.outbox.c.application_id == target["id"]).values(status="sent"))
    assert client.delete(path, json=version, headers=auth).json == {"deleted": True}
    assert client.get(path).status_code == 404
    assert client.delete(path, json=version, headers=auth).status_code == 404
    assert client.get("/api/admin/applications?search=" + target["number"]).json["total"] == 0
    assert target["number"] not in client.get("/api/admin/applications/export").get_data(as_text=True)
    with app.extensions["db"].connect() as conn:
        assert conn.execute(select(db.applications.c.id)).scalars().all() == [other["id"]]
        assert conn.execute(select(db.outbox.c.application_id)).scalars().all() == [other["id"], other["id"]]


def test_delete_waits_for_active_mail_worker_and_cancels_pending_mail(app, client, auth):
    assert submit(client).status_code == 201
    target = client.get("/api/admin/applications").json["applications"][0]
    path = "/api/admin/applications/" + target["id"]
    def during_send(message):
        response = client.delete(path, json={"version": target["version"]}, headers=auth)
        assert response.status_code == 409
        assert "отправляется письмо" in response.json["message"]
        # A rejected deletion rolls back the version reservation.
        assert client.get(path).json["application"]["version"] == target["version"]
    assert deliver(app.extensions["db"], maximum=1, send=during_send)["sent"] == 1
    assert client.delete(path, json={"version": target["version"]}, headers=auth).status_code == 200
    assert deliver(app.extensions["db"], send=lambda _: pytest.fail("Deleted mail must not be sent"))["sent"] == 0


@pytest.mark.parametrize("failed_status", ["retry", "failed"])
def test_admin_can_requeue_only_failed_mail_without_resending_delivered_mail(app, client, auth, failed_status):
    for _ in range(2):
        assert submit(client).status_code == 201
    target, other = client.get("/api/admin/applications").json["applications"]
    path = "/api/admin/applications/" + target["id"]
    retry_path = path + "/retry-mail"
    version = {"version": target["version"]}
    engine = app.extensions["db"]
    with engine.begin() as conn:
        ids = conn.execute(select(db.outbox.c.id).where(db.outbox.c.application_id == target["id"])).scalars().all()
        conn.execute(db.outbox.update().values(status=failed_status, attempts=8, available_at=9999999999, last_error="OSError"))
        conn.execute(db.outbox.update().where(db.outbox.c.id == ids[0]).values(status="sent", attempts=1, last_error=""))
    assert app.test_client().post(retry_path, json=version, headers=auth).status_code == 401
    assert client.post(retry_path, json=version).status_code == 403
    assert client.post(retry_path, json={"version": False}, headers=auth).status_code == 422
    assert client.post(retry_path, json={"version": 99}, headers=auth).status_code == 409
    response = client.post(retry_path, json=version, headers=auth)
    assert response.status_code == 200
    record = response.json["application"]
    assert record["version"] == target["version"] + 1
    assert sorted(mail["status"] for mail in record["mail"]) == ["pending", "sent"]
    assert client.post(retry_path, json=version, headers=auth).status_code == 409
    assert client.post(retry_path, json={"version": record["version"]}, headers=auth).status_code == 409
    assert client.get(path).json["application"]["version"] == record["version"]
    with engine.connect() as conn:
        queued = conn.execute(select(db.outbox).where(db.outbox.c.id == ids[1])).mappings().one()
        assert queued["attempts"] == 0 and queued["last_error"] == "" and queued["lease_until"] == 0
        assert conn.execute(select(db.outbox.c.status).where(db.outbox.c.application_id == other["id"])).scalars().all() == [failed_status, failed_status]
    messages = []
    assert deliver(engine, send=messages.append)["sent"] == 1
    assert deliver(engine, send=messages.append)["sent"] == 0


def test_application_pagination_recovers_when_last_page_is_deleted(app, client, auth):
    assert submit(client).status_code == 201
    with app.extensions["db"].begin() as conn:
        template = dict(conn.execute(select(db.applications)).mappings().one())
        conn.execute(db.applications.insert(), [
            {**template, "id": str(uuid.uuid4()), "number": str(uuid.uuid4()), "idempotency_key": str(uuid.uuid4())}
            for _ in range(25)
        ])
    last_page = client.get("/api/admin/applications?page=2").json
    assert last_page["total"] == 26 and len(last_page["applications"]) == 1
    target = last_page["applications"][0]
    assert client.delete("/api/admin/applications/" + target["id"], json={"version": target["version"]}, headers=auth).status_code == 200
    result = client.get("/api/admin/applications?page=2").json
    assert result["page"] == result["pages"] == 1
    assert result["total"] == result["counts"]["new"] == len(result["applications"]) == 25


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


def test_cookies_page_upgrades_existing_settings_without_overwriting_legal_text(app, client, auth):
    saved = copy.deepcopy(DEFAULTS)
    del saved["pages"]["cookies"]
    saved["pages"]["privacy"]["sections"][0]["text"] = "Сохранённые реквизиты оператора."
    with app.extensions["db"].begin() as conn:
        conn.execute(db.settings.update().where(db.settings.c.id == 1).values(data=db.encode(saved)))

    public = app.test_client()
    response = public.get("/cookies")
    assert response.status_code == 200
    assert "__Host-dance_admin" in response.get_data(as_text=True)
    assert 'href="/privacy"' in response.get_data(as_text=True)
    assert "Set-Cookie" not in response.headers
    assert public.get("/cookies/").headers["Location"] == "/cookies"
    assert public.get("/cookies.html").headers["Location"] == "/cookies"
    assert "/cookies</loc>" in public.get("/sitemap.xml").get_data(as_text=True)

    record = client.get("/api/admin/settings").json
    assert record["settings"]["pages"]["privacy"] == saved["pages"]["privacy"]
    record["settings"]["pages"]["cookies"]["sections"][0]["text"] = '<script>alert(1)</script> Контакты: {email}.'
    assert client.put("/api/admin/settings", json=record, headers=auth).status_code == 200
    content = public.get("/cookies").get_data(as_text=True)
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in content
    assert "<script>alert(1)" not in content
    assert f'mailto:{saved["contacts"]["email"]}' in content
    assert "Сохранённые реквизиты оператора." in public.get("/privacy").get_data(as_text=True)
    assert public.put("/api/admin/settings", json=record).status_code == 401


def test_public_pages_and_application_do_not_set_cookies(client):
    for path in ("/", "/privacy", "/consent", "/cookies", "/news", "/api/settings"):
        response = client.get(path)
        assert response.status_code == 200
        assert "Set-Cookie" not in response.headers
    response = submit(client)
    assert response.status_code == 201
    assert "Set-Cookie" not in response.headers


def test_seo_is_server_rendered_editable_and_retired_social_links_are_not_exposed(app, client, auth):
    saved = copy.deepcopy(DEFAULTS)
    del saved["seo"]
    saved["contacts"].update(instagramUrl="https://example.com/retired-instagram", whatsappUrl="https://example.com/retired-whatsapp")
    with app.extensions["db"].begin() as conn:
        conn.execute(db.settings.update().values(data=db.encode(saved)))
    public = app.test_client()
    document = public.get("/").get_data(as_text=True)
    assert document.count("<h1 ") == 1
    assert "Ильдар Гайнутдинов" in document and "Народный танец" in document
    assert "retired-instagram" not in document and "retired-whatsapp" not in document
    assert "instagramUrl" not in public.get("/api/settings").get_data(as_text=True)
    graph = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', document, re.S)[1])["@graph"]
    event = next(item for item in graph if item["@type"] == "DanceEvent")
    assert event["startDate"] == "2027-04-03" and event["endDate"] == "2027-04-04"
    assert 'href="http://localhost/"' in document
    assert public.get("/index.html").status_code == 301

    record = client.get("/api/admin/settings").json
    record["settings"]["seo"].update(title="Конкурс {year}: {dates} — {city} $& <script>", description="{venue}: {dates}", googleVerification="test_Google-code", yandexVerification="testYandexCode")
    record["settings"]["event"].update(startDate="2028-04-03", endDate="2028-04-04", arrivalDate="2028-04-02", departureDate="2028-04-05")
    assert client.put("/api/admin/settings", json=record, headers=auth).status_code == 200
    document = public.get("/").get_data(as_text=True)
    assert "Конкурс 2028: 3–4 апреля 2028 — Москва $&amp; &lt;script&gt;</title>" in document
    assert '<meta name="google-site-verification" content="test_Google-code">' in document
    assert '<meta name="yandex-verification" content="testYandexCode">' in document
    assert '<meta property="og:title"' in document
    assert '<script>"' not in document
    assert '"startDate": "2028-04-03"' in document
    assert 'href="/news"' in document


def test_news_pagination_has_distinct_canonicals_and_real_404s(app, client):
    with app.extensions["db"].begin() as conn:
        for index in range(25):
            conn.execute(db.articles.insert().values(id=str(uuid.uuid4()), slug=f"article-{index}", title=f"Article {index}", description="Description", category="News", date="2026-11-01", image="", sections=db.encode([]), published=True, version=1, updated_at=db.timestamp()))
    second = client.get("/news?page=2")
    assert second.status_code == 200
    assert '<link rel="canonical" href="http://localhost/news?page=2">' in second.get_data(as_text=True)
    assert "страница 2" in second.get_data(as_text=True)
    assert client.get("/news?page=1").headers["Location"] == "/news"
    assert client.get("/news?page=02").headers["Location"] == "/news?page=2"
    assert client.get("/news?page=not-a-number").headers["Location"] == "/news"
    assert client.get("/news?page=3").status_code == 404
    assert client.get("/news?page=-1").status_code == 404


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
