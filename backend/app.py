import base64
import csv
import hashlib
import html
import io
import json
import os
import re
import time
import uuid
import warnings
import zipfile
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request, send_from_directory, redirect
from PIL import Image, UnidentifiedImageError
from sqlalchemy import select, update, delete, func, or_
from sqlalchemy.engine import URL
from sqlalchemy.exc import IntegrityError
from werkzeug.exceptions import HTTPException

from . import db, render, security
from .validation import (ROOT, DEFAULTS, Problem, check, validate_settings, validate_article,
                         validate_application, merge_defaults, settings_images, text)

STATUSES = {"new": "Новая", "in_progress": "В работе", "confirmed": "Подтверждена", "rejected": "Отклонена", "archived": "В архиве"}
APPLICATION_LABELS = {"collective": "Коллектив", "performanceTitle": "Конкурсный номер", "participantCount": "Участников", "duration": "Хронометраж", "nomination": "Номинация", "ageCategory": "Возраст", "professionalLevel": "Уровень", "participants": "Состав участников", "institution": "Учреждение", "country": "Страна", "city": "Город", "director": "Руководитель", "teacher": "Педагог", "accommodation": "Проживание", "hotelGuests": "Проживающие", "email": "E-mail", "phone": "Телефон", "telegram": "Telegram", "comment": "Комментарий", "regulationsAccepted": "Положение принято", "personalDataAccepted": "Согласие на ПД"}


def create_app(config=None):
    load_dotenv(ROOT / ".env.local", override=False)
    load_dotenv(ROOT / ".env", override=False)
    application = Flask(__name__, static_folder=None)
    production = os.environ.get("APP_ENV") == "production"
    data_dir = Path(os.environ.get("DATA_DIR") or ROOT / ".data").resolve()
    data_dir.mkdir(parents=True, exist_ok=True)
    database_url = os.environ.get("DATABASE_URL")
    if not database_url and os.environ.get("MYSQL_DATABASE"):
        database_url = URL.create("mysql+pymysql", username=os.environ.get("MYSQL_USER"), password=os.environ.get("MYSQL_PASSWORD"), host=os.environ.get("MYSQL_HOST", "localhost"), port=int(os.environ.get("MYSQL_PORT", "3306")), database=os.environ["MYSQL_DATABASE"], query={"charset": "utf8mb4"}).render_as_string(hide_password=False)
    application.config.update(PRODUCTION=production, SITE_URL=os.environ.get("SITE_URL", "").rstrip("/"), DATA_DIR=data_dir,
                              DATABASE_URL=database_url or f"sqlite:///{(data_dir / 'site-python.sqlite').as_posix()}",
                              MAX_CONTENT_LENGTH=10 * 1024 * 1024, TESTING=False)
    if config:
        application.config.update(config)
    origin = application.config["SITE_URL"]
    if application.config["PRODUCTION"]:
        parsed = urlsplit(origin)
        if parsed.scheme != "https" or not parsed.hostname or parsed.path or parsed.username or parsed.password:
            raise RuntimeError("Set SITE_URL=https://your-domain without a path")
        if not application.config["DATABASE_URL"].startswith("mysql+pymysql:"):
            raise RuntimeError("Production requires MySQL; configure MYSQL_DATABASE, MYSQL_USER and MYSQL_PASSWORD")
        application.config["TRUSTED_HOSTS"] = [parsed.hostname]
    else:
        application.config["TRUSTED_HOSTS"] = ["localhost", "127.0.0.1", "[::1]"]
    engine = db.connect(application.config["DATABASE_URL"])
    application.extensions["db"] = engine
    uploads = Path(application.config["DATA_DIR"]) / "uploads"
    uploads.mkdir(parents=True, exist_ok=True)

    def settings_record():
        with engine.connect() as conn:
            row = conn.execute(select(db.settings).where(db.settings.c.id == 1)).mappings().first()
        check(row is not None, "База не подготовлена. Выполните init-db.", 503)
        return {"settings": merge_defaults(json.loads(row["data"])), "version": row["version"], "updatedAt": row["updated_at"]}

    application.extensions["settings_record"] = settings_record

    def origin_url():
        return application.config["SITE_URL"] or request.host_url.rstrip("/")

    def styles():
        filename = ROOT / "dist" / "index.html"
        if filename.exists():
            return "".join(re.findall(r'<link\b(?=[^>]*rel="stylesheet")[^>]*>', filename.read_text(encoding="utf-8")))
        return '<link rel="stylesheet" href="/src/styles.css">'

    def body(limit=262144):
        check(request.mimetype == "application/json", "Ожидается JSON.", 415)
        raw = request.get_data()
        check(len(raw) <= limit, "Слишком большой запрос.", 413)
        try:
            value = json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            raise Problem(400, "Некорректный JSON.")
        check(isinstance(value, dict), "Ожидается объект JSON.", 400)
        return value

    def verify_uploads(images, document=None):
        references = [p.split("/")[-1] for p in images if p.startswith("/media/")]
        if document and document.startswith("/documents/"):
            references.append(document.split("/")[-1])
        if references:
            with engine.connect() as conn:
                found = set(conn.execute(select(db.media.c.name).where(db.media.c.name.in_(references))).scalars())
            check(all(name in found and (uploads / name).is_file() for name in references), "Загрузите файл заново.")

    @application.after_request
    def headers(response):
        response.headers.setdefault("Cache-Control", "no-store")
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "same-origin"
        if application.config["PRODUCTION"]:
            response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self'; font-src 'self'; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
        if request.path.startswith("/admin") or request.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
            response.headers["X-Robots-Tag"] = "noindex, nofollow"
        return response

    @application.errorhandler(Exception)
    def error_handler(error):
        if isinstance(error, Problem):
            result = jsonify(message=error.message)
            result.status_code = error.status
            if error.status == 429:
                result.headers["Retry-After"] = str(getattr(error, "retry_after", 900))
            return result
        if isinstance(error, HTTPException):
            return jsonify(message={404: "Страница не найдена.", 405: "Метод не поддерживается.", 413: "Слишком большой файл.", 400: "Некорректный запрос."}.get(error.code, "Запрос отклонён.")), error.code
        # Never log submitted personal data, SQL parameters, passwords or DSNs.
        application.logger.error("Request failed: %s", type(error).__name__)
        return jsonify(message="Не удалось выполнить запрос. Попробуйте позже."), 500

    @application.get("/health")
    def health():
        with engine.connect() as conn:
            conn.execute(select(db.schema_version.c.version)).scalar_one()
        return jsonify(ok=True)

    @application.get("/api/settings")
    def public_settings():
        return jsonify(settings=settings_record()["settings"])

    @application.post("/api/admin/login")
    def login():
        security.same_origin()
        value = body(4096)
        login_name = str(value.get("login", "")).strip().lower()
        password = value.get("password")
        check(re.fullmatch(r"[a-z0-9][a-z0-9._@-]{2,63}", login_name) and isinstance(password, str) and 0 < len(password) <= 256, "Проверьте логин и пароль.", 400)
        security.rate_limit("login-ip:" + security.client_ip(), 30, 900)
        security.rate_limit("login:" + login_name, 10, 900)
        with engine.connect() as conn:
            user = conn.execute(select(db.users).where(db.users.c.login == login_name)).mappings().first()
        check(security.verify_password(password, user["password_hash"] if user else None), "Неверный логин или пароль.", 401)
        response = jsonify()
        csrf = security.start_session(user["id"], response)
        response.set_data(application.json.dumps({"user": {"login": login_name}, "csrf": csrf}))
        return response

    @application.get("/api/admin/session")
    @security.admin()
    def admin_session():
        record = security.require_session()
        return jsonify(user={"login": record["login"]}, csrf=record["csrf"])

    @application.post("/api/admin/logout")
    @security.admin(mutation=True)
    def logout():
        with engine.begin() as conn:
            conn.execute(delete(db.sessions).where(db.sessions.c.token_hash == security.require_session()["token_hash"]))
        response = jsonify(ok=True)
        response.delete_cookie(security.cookie_name(), path="/", secure=application.config["PRODUCTION"], httponly=True, samesite="Lax")
        return response

    @application.get("/api/admin/settings")
    @security.admin()
    def read_settings():
        return jsonify(settings_record())

    @application.put("/api/admin/settings")
    @security.admin(mutation=True)
    def save_settings():
        value = body(512000)
        settings = validate_settings(value.get("settings"))
        verify_uploads(settings_images(settings), settings["documents"]["regulations"])
        check(type(value.get("version")) is int, "Загрузите настройки заново.", 409)
        with engine.begin() as conn:
            changed = conn.execute(update(db.settings).where(db.settings.c.id == 1, db.settings.c.version == value["version"]).values(data=db.encode(settings), version=db.settings.c.version + 1, updated_at=db.timestamp()))
            check(changed.rowcount == 1, "Настройки изменены в другой вкладке. Сохраните текст и загрузите актуальную версию.", 409)
        return jsonify(settings_record())

    @application.post("/api/admin/media")
    @application.post("/api/admin/documents")
    @security.admin(mutation=True)
    def upload():
        content = request.get_data()
        is_document = request.path.endswith("documents")
        check(0 < len(content) <= (10 if is_document else 2) * 1024 * 1024, "Слишком большой файл.", 413)
        if is_document:
            if content.startswith(b"%PDF-"):
                extension, mime = "pdf", "application/pdf"
            else:
                try:
                    with zipfile.ZipFile(io.BytesIO(content)) as archive:
                        check("word/document.xml" in archive.namelist() and "[Content_Types].xml" in archive.namelist(), "Нужен PDF или DOCX.", 415)
                        check(sum(item.file_size for item in archive.infolist()) <= 50 * 1024 * 1024, "Документ слишком большой.", 413)
                except zipfile.BadZipFile:
                    raise Problem(415, "Нужен PDF или DOCX.")
                extension, mime = "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        else:
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter("error", Image.DecompressionBombWarning)
                    with Image.open(io.BytesIO(content)) as image:
                        check(image.format in ("JPEG", "PNG", "WEBP"), "Нужен JPG, PNG или WebP.", 415)
                        extension, mime = {"JPEG": ("jpg", "image/jpeg"), "PNG": ("png", "image/png"), "WEBP": ("webp", "image/webp")}[image.format]
                        image.verify()
            except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning):
                raise Problem(415, "Повреждённое или слишком большое изображение.")
        name = f"{uuid.uuid4()}.{extension}"
        filename = uploads / name
        try:
            with filename.open("xb") as stream:
                stream.write(content)
            with engine.begin() as conn:
                conn.execute(db.media.insert().values(name=name, mime=mime, size=len(content), created_at=db.timestamp()))
        except Exception:
            filename.unlink(missing_ok=True)
            raise
        return jsonify(url=f"/{'documents' if is_document else 'media'}/{name}"), 201

    def article_input(value):
        result = validate_article(value)
        verify_uploads([result["image"]])
        return result

    def article_cards(public=False, limit=1000, offset=0):
        columns = [c for c in db.articles.c if c.name != "sections"]
        query = select(*columns)
        if public:
            query = query.where(db.articles.c.published.is_(True))
        with engine.connect() as conn:
            return [db.decode_article(row) for row in conn.execute(query.order_by(db.articles.c.date.desc(), db.articles.c.updated_at.desc(), db.articles.c.id).limit(limit).offset(offset)).mappings()]

    @application.get("/api/admin/articles")
    @security.admin()
    def admin_articles():
        return jsonify(articles=article_cards())

    @application.post("/api/admin/articles")
    @security.admin(mutation=True)
    def create_article():
        item = article_input(body())
        item.update(id=str(uuid.uuid4()), version=1, updated_at=db.timestamp())
        try:
            with engine.begin() as conn:
                conn.execute(db.articles.insert().values(**{**item, "sections": db.encode(item["sections"])}))
        except IntegrityError:
            raise Problem(409, "Этот адрес статьи уже занят.")
        return jsonify(article=item), 201

    @application.route("/api/admin/articles/<article_id>", methods=["GET", "PUT", "DELETE"])
    @security.admin()
    def change_article(article_id):
        with engine.connect() as conn:
            row = conn.execute(select(db.articles).where(db.articles.c.id == article_id)).mappings().first()
        check(row is not None, "Публикация не найдена.", 404)
        if request.method == "GET":
            return jsonify(article=db.decode_article(row))
        security.same_origin()
        check(security.session()["csrf"] == request.headers.get("X-CSRF-Token"), "Обновите страницу.", 403)
        value = body()
        check(type(value.get("version")) is int, "Запись изменена в другой вкладке.", 409)
        condition = (db.articles.c.id == article_id) & (db.articles.c.version == value["version"])
        item = None
        if request.method == "PUT":
            item = article_input(value)
            check(item["slug"] == row["slug"], "Адрес сохранённой статьи менять нельзя.")
            item.update(version=value["version"] + 1, updated_at=db.timestamp())
        with engine.begin() as conn:
            statement = delete(db.articles).where(condition) if item is None else update(db.articles).where(condition).values(**{**item, "sections": db.encode(item["sections"])})
            check(conn.execute(statement).rowcount == 1, "Запись изменена в другой вкладке. Откройте её заново.", 409)
        return jsonify(ok=True) if item is None else jsonify(article={**item, "id": article_id})

    @application.post("/api/admin/preview")
    @security.admin(mutation=True)
    def preview():
        article = article_input(body())
        if article["image"].startswith("/media/"):
            name = article["image"].split("/")[-1]
            with engine.connect() as conn:
                mime = conn.execute(select(db.media.c.mime).where(db.media.c.name == name)).scalar_one()
            article["image"] = f"data:{mime};base64," + base64.b64encode((uploads / name).read_bytes()).decode()
        return jsonify(html=render.page("article", settings_record()["settings"], origin_url(), styles(), article=article, pathname="/news/" + article["slug"], noindex=True))

    @application.get("/api/news")
    def public_news():
        return jsonify(articles=article_cards(True, 3))

    @application.route("/media/<name>")
    @application.route("/documents/<name>")
    def uploaded_file(name):
        check(re.fullmatch(r"[a-f0-9-]{36}\.(?:jpg|png|webp|pdf|docx)", name), "Файл не найден.", 404)
        document = request.path.startswith("/documents/")
        check(document == bool(re.search(r"\.(pdf|docx)$", name)), "Файл не найден.", 404)
        with engine.connect() as conn:
            media = conn.execute(select(db.media).where(db.media.c.name == name)).mappings().first()
            public_image = conn.execute(select(db.articles.c.id).where(db.articles.c.image == request.path, db.articles.c.published.is_(True)).limit(1)).first()
        settings = settings_record()["settings"]
        public_setting = settings["documents"]["regulations"] == request.path if document else request.path in settings_images(settings)
        check(media is not None and (public_image or public_setting or security.session()), "Файл не найден.", 404)
        response = send_from_directory(uploads, name, mimetype=media["mime"], as_attachment=document, download_name="regulations." + name.split(".")[-1] if document else None)
        response.headers["Cache-Control"] = "private, no-cache"
        return response

    register_applications(application, engine, settings_record, body)

    @application.get("/")
    @application.get("/index.html")
    def home():
        template = ROOT / "dist" / "index.html"
        check(template.is_file(), "Выполните npm run build.", 503)
        return Response(render.site_shell(template.read_text(encoding="utf-8"), settings_record()["settings"], origin_url()), mimetype="text/html")

    @application.get("/admin")
    @application.get("/admin/")
    @application.get("/admin/<path:subpath>")
    def admin_page(subpath=""):
        return send_from_directory(ROOT / "dist" / "admin", "index.html")

    @application.get("/privacy")
    @application.get("/consent")
    def legal_page():
        settings = settings_record()["settings"]
        document = settings["pages"][request.path[1:]]
        return render.page("legal", settings, origin_url(), styles(), document=document, title=document["title"], description=document["lead"], pathname=request.path)

    @application.get("/privacy.html")
    @application.get("/consent.html")
    @application.get("/privacy/")
    @application.get("/consent/")
    def legal_redirect():
        return redirect(request.path.removesuffix(".html").rstrip("/"), 301)

    @application.get("/news")
    def news_index():
        current_page = min(max(request.args.get("page", 1, type=int), 1), 1000)
        rows = article_cards(True, 25, (current_page - 1) * 24)
        return render.page("news", settings_record()["settings"], origin_url(), styles(), articles=rows[:24], has_next=len(rows) > 24, current_page=current_page, noindex=not rows)

    @application.get("/news/")
    @application.get("/news.html")
    def news_redirect():
        return redirect("/news", 308)

    @application.get("/news/<slug>")
    def article_page(slug):
        with engine.connect() as conn:
            row = conn.execute(select(db.articles).where(db.articles.c.slug == slug, db.articles.c.published.is_(True))).mappings().first()
        settings = settings_record()["settings"]
        if not row:
            return render.page("missing", settings, origin_url(), styles(), title="Материал не найден", noindex=True), 404
        return render.page("article", settings, origin_url(), styles(), article=db.decode_article(row), pathname=request.path)

    @application.get("/sitemap.xml")
    def sitemap():
        rows = article_cards(True, 50000)
        paths = ["/", "/privacy", "/consent"] + (["/news"] if rows else []) + ["/news/" + a["slug"] for a in rows]
        content = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + "".join("<url><loc>" + html.escape(origin_url() + p) + "</loc></url>" for p in paths) + "</urlset>"
        return Response(content, mimetype="application/xml")

    @application.get("/robots.txt")
    def robots():
        return Response(f"User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: {origin_url()}/sitemap.xml\n", mimetype="text/plain")

    @application.get("/assets/<path:name>")
    @application.get("/docs/<path:name>")
    @application.get("/bundles/<path:name>")
    def static_file(name):
        prefix = request.path.split("/")[1]
        response = send_from_directory(Path(os.environ.get("PUBLIC_DIR", ROOT / "dist")) / prefix, name)
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable" if prefix == "bundles" else "no-cache"
        return response

    return application


def register_applications(app, engine, settings_record, body):
    @app.post("/api/application")
    def submit_application():
        value = body(65536)
        if isinstance(value.get("website"), str) and value["website"].strip():
            return jsonify(applicationNumber="TR-RECEIVED")
        key = request.headers.get("Idempotency-Key", "")
        check(re.fullmatch(r"[a-f0-9-]{36}", key), "Обновите страницу и отправьте заявку снова.", 400)
        settings = settings_record()["settings"]
        data = validate_application(value, settings)
        payload_hash = hashlib.sha256(db.encode(data).encode()).hexdigest()
        with engine.connect() as conn:
            previous = conn.execute(select(db.applications.c.number, db.applications.c.payload_hash).where(db.applications.c.idempotency_key == key)).mappings().first()
        if previous:
            check(previous["payload_hash"] == payload_hash, "Эта отправка уже завершена с другими данными. Обновите страницу.", 409)
            return jsonify(applicationNumber=previous["number"], saved=True)
        security.rate_limit("application-ip:" + security.client_ip(), 10, 900)
        security.rate_limit("application-email:" + data["email"].lower(), 10, 3600)
        identity, now = str(uuid.uuid4()), db.timestamp()
        number = f'TR-{settings["event"]["startDate"][:4]}-{uuid.uuid4().hex[:12].upper()}'
        fields = {k: data[k] for k in ("collective", "email", "city", "nomination")}
        confirmation = f'Заявка {number} сохранена.\nКоллектив: {data["collective"]}\nНомер: {data["performanceTitle"]}\nОргкомитет свяжется с вами после рассмотрения.\nКонтакты: {settings["contacts"]["email"]}, {settings["contacts"]["phone"]}'
        details = "\n".join(f"{label}: {data.get(key, '')}" for key, label in APPLICATION_LABELS.items())
        try:
            with engine.begin() as conn:
                conn.execute(db.applications.insert().values(id=identity, number=number, idempotency_key=key, payload_hash=payload_hash, **fields, status="new", notes="", data=db.encode(data), event_snapshot=db.encode({"event": settings["event"], "prices": settings["prices"], "documents": settings["documents"], "consent": settings["pages"]["consent"]}), version=1, created_at=now, updated_at=now))
                for recipient, subject, content in [(settings["contacts"]["email"], "Новая заявка " + number, details), (data["email"], "Заявка принята: " + number, confirmation)]:
                    conn.execute(db.outbox.insert().values(id=str(uuid.uuid4()), application_id=identity, recipient=recipient, subject=subject, body=content, status="pending", attempts=0, available_at=int(time.time()), lease_until=0, last_error=""))
        except IntegrityError:
            with engine.connect() as conn:
                previous = conn.execute(select(db.applications.c.number, db.applications.c.payload_hash).where(db.applications.c.idempotency_key == key)).mappings().first()
            check(previous and previous["payload_hash"] == payload_hash, "Не удалось сохранить заявку. Повторите отправку.", 409)
            number = previous["number"]
        return jsonify(applicationNumber=number, saved=True), 201

    def filters():
        clauses = []
        status = request.args.get("status", "")
        if status:
            check(status in STATUSES, "Некорректный статус.", 400)
            clauses.append(db.applications.c.status == status)
        search = request.args.get("search", "").strip()[:180]
        if search:
            clauses.append(or_(*[col.contains(search, autoescape=True) for col in (db.applications.c.number, db.applications.c.collective, db.applications.c.email, db.applications.c.city)]))
        return clauses

    @app.get("/api/admin/applications")
    @security.admin()
    def application_list():
        page = min(max(request.args.get("page", 1, type=int), 1), 100000)
        clauses = filters()
        columns = [db.applications.c[key] for key in ("id", "number", "collective", "city", "email", "nomination", "status", "created_at", "version")]
        with engine.connect() as conn:
            total = conn.execute(select(func.count()).select_from(db.applications).where(*clauses)).scalar_one()
            rows = conn.execute(select(*columns).where(*clauses).order_by(db.applications.c.created_at.desc(), db.applications.c.id).limit(25).offset((page - 1) * 25)).mappings().all()
            counts = dict(conn.execute(select(db.applications.c.status, func.count()).group_by(db.applications.c.status)).all())
        return jsonify(applications=[dict(row) for row in rows], total=total, page=page, pages=max(1, (total + 24) // 25), counts=counts, statuses=STATUSES)

    @app.get("/api/admin/applications/export")
    @security.admin()
    def application_export():
        # Bounded exports avoid exhausting a shared hosting worker.
        with engine.connect() as conn:
            rows = conn.execute(select(db.applications).where(*filters()).order_by(db.applications.c.created_at.desc()).limit(5001)).mappings().all()
        check(len(rows) <= 5000, "Слишком много записей. Сузьте поиск или выберите статус.")
        stream = io.StringIO(newline="")
        writer = csv.writer(stream, delimiter=";")
        def safe(value):
            value = str(value)
            return "'" + value if value.lstrip().startswith(("=", "+", "-", "@")) or value.startswith(("\t", "\r", "\n")) else value
        writer.writerow(["Номер", "Дата UTC", "Статус", *APPLICATION_LABELS.values(), "Заметки"])
        for row in rows:
            data = json.loads(row["data"])
            writer.writerow([safe(item) for item in [row["number"], row["created_at"], STATUSES[row["status"]], *[data.get(k, "") for k in APPLICATION_LABELS], row["notes"]]])
        response = Response("\ufeff" + stream.getvalue(), mimetype="text/csv")
        response.headers["Content-Disposition"] = 'attachment; filename="applications.csv"'
        return response

    @app.get("/api/admin/applications/<identity>")
    @security.admin()
    def application_detail(identity):
        with engine.connect() as conn:
            row = conn.execute(select(db.applications).where(db.applications.c.id == identity)).mappings().first()
            mail = conn.execute(select(db.outbox.c.recipient, db.outbox.c.status, db.outbox.c.attempts).where(db.outbox.c.application_id == identity)).mappings().all()
        check(row is not None, "Заявка не найдена.", 404)
        result = {key: value for key, value in row.items() if key not in ("idempotency_key", "payload_hash")}
        result.update(data=json.loads(row["data"]), event_snapshot=json.loads(row["event_snapshot"]), mail=[dict(item) for item in mail])
        return jsonify(application=result, statuses=STATUSES)

    @app.put("/api/admin/applications/<identity>")
    @security.admin(mutation=True)
    def application_update(identity):
        value = body(16384)
        check(value.get("status") in STATUSES and type(value.get("version")) is int, "Проверьте статус заявки.")
        notes = text(value.get("notes", ""), "Заметки", 5000, True)
        with engine.begin() as conn:
            changed = conn.execute(update(db.applications).where(db.applications.c.id == identity, db.applications.c.version == value["version"]).values(status=value["status"], notes=notes, version=db.applications.c.version + 1, updated_at=db.timestamp()))
            check(changed.rowcount == 1, "Заявка изменена в другой вкладке. Обновите карточку.", 409)
        return application_detail(identity)
