import hashlib
import hmac
import secrets
import time
from functools import wraps
from flask import current_app, g, request
from sqlalchemy import select, delete, update, case
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from werkzeug.security import generate_password_hash, check_password_hash
from .db import users, sessions, limits
from .validation import Problem, check


def digest(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def password_hash(password):
    check(isinstance(password, str) and 12 <= len(password) <= 256, "Пароль должен содержать от 12 до 256 символов.")
    return generate_password_hash(password, method="pbkdf2:sha256:1000000")


DUMMY = "pbkdf2:sha256:1000000$invalid$" + "0" * 64


def verify_password(password, encoded):
    # Existing Node accounts can be imported without exposing their passwords.
    if encoded and encoded.startswith("scrypt:"):
        try:
            _, salt, expected = encoded.split(":")
            actual = hashlib.scrypt(password.encode(), salt=salt.encode(), n=131072, r=8, p=1, dklen=64, maxmem=256 * 1024 * 1024)
            return hmac.compare_digest(actual.hex(), expected)
        except (ValueError, TypeError):
            return False
    return check_password_hash(encoded or DUMMY, password)


def cookie_name():
    return "__Host-dance_admin" if current_app.config["PRODUCTION"] else "dance_admin"


def session():
    if hasattr(g, "admin_session"):
        return g.admin_session
    token = request.cookies.get(cookie_name(), "")
    g.admin_session = None
    if len(token) == 64:
        with current_app.extensions["db"].connect() as conn:
            row = conn.execute(select(sessions, users.c.login).join(users).where(sessions.c.token_hash == digest(token), sessions.c.expires_at > int(time.time()))).mappings().first()
            g.admin_session = dict(row) if row else None
    return g.admin_session


def require_session():
    record = session()
    check(record is not None, "Войдите в админ-панель.", 401)
    return record


def same_origin():
    expected = current_app.config["SITE_URL"] or request.host_url.rstrip("/")
    check(request.headers.get("Origin") == expected and request.headers.get("X-Admin-Request") == "1", "Запрос отклонён. Обновите страницу.", 403)


def admin(mutation=False):
    def decorator(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            record = require_session()
            if mutation:
                same_origin()
                check(hmac.compare_digest(request.headers.get("X-CSRF-Token", ""), record["csrf"]), "Сессия страницы устарела. Обновите страницу.", 403)
            return fn(*args, **kwargs)
        return wrapped
    return decorator


def start_session(user_id, response):
    token, csrf = secrets.token_hex(32), secrets.token_hex(32)
    with current_app.extensions["db"].begin() as conn:
        conn.execute(delete(sessions).where(sessions.c.expires_at <= int(time.time())))
        conn.execute(sessions.insert().values(token_hash=digest(token), user_id=user_id, csrf=csrf, expires_at=int(time.time()) + 28800))
    response.set_cookie(cookie_name(), token, max_age=28800, secure=current_app.config["PRODUCTION"], httponly=True, samesite="Lax", path="/")
    return csrf


def rate_limit(key, maximum, period):
    """Atomic counter, shared by all Passenger workers. No in-memory limits."""
    engine = current_app.extensions["db"]
    key, now = digest(key), int(time.time())
    with engine.begin() as conn:
        expired = limits.c.expires_at <= now
        values = [("count", case((expired, 1), else_=limits.c.count + 1)),
                  ("expires_at", case((expired, now + period), else_=limits.c.expires_at))]
        if engine.dialect.name == "mysql":
            statement = mysql_insert(limits).values(key=key, count=1, expires_at=now + period).on_duplicate_key_update(values)
        else:
            statement = sqlite_insert(limits).values(key=key, count=1, expires_at=now + period).on_conflict_do_update(index_elements=[limits.c.key], set_=dict(values))
        # One row lock; DELETE + INSERT causes gap-lock deadlocks in InnoDB.
        conn.execute(statement)
        record = conn.execute(select(limits.c.count, limits.c.expires_at).where(limits.c.key == key)).one()
        if record.count > maximum:
            error = Problem(429, "Слишком много запросов. Попробуйте позже.")
            error.retry_after = max(1, record.expires_at - now)
            raise error


def client_ip():
    # REMOTE_ADDR is set by the hosting web server; never trust arbitrary XFF.
    return request.remote_addr or "unknown"
