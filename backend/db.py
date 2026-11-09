import json
from datetime import datetime, timezone
from sqlalchemy import (MetaData, Table, Column, Integer, String, Text, Boolean,
                        BigInteger, ForeignKey, Index, create_engine, select)
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.pool import NullPool

metadata = MetaData()
body_type = Text().with_variant(LONGTEXT(), "mysql")


def table(name, *columns):
    return Table(name, metadata, *columns, mysql_engine="InnoDB",
                 mysql_charset="utf8mb4", mysql_collate="utf8mb4_unicode_ci")


users = table("users", Column("id", Integer, primary_key=True),
              Column("login", String(64), unique=True, nullable=False),
              Column("password_hash", String(256), nullable=False))
sessions = table("sessions", Column("token_hash", String(64), primary_key=True),
                 Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
                 Column("csrf", String(64), nullable=False),
                 Column("expires_at", BigInteger, nullable=False, index=True))
limits = table("request_limits", Column("key", String(100), primary_key=True),
               Column("count", Integer, nullable=False), Column("expires_at", BigInteger, nullable=False, index=True))
settings = table("site_settings", Column("id", Integer, primary_key=True),
                 Column("data", body_type, nullable=False), Column("version", Integer, nullable=False, default=1),
                 Column("updated_at", String(32), nullable=False))
articles = table("articles", Column("id", String(36), primary_key=True),
                 Column("slug", String(100), unique=True, nullable=False),
                 Column("title", String(200), nullable=False), Column("description", Text, nullable=False),
                 Column("category", String(60), nullable=False), Column("date", String(10), nullable=False),
                 Column("image", String(2048), nullable=False, default=""),
                 Column("sections", body_type, nullable=False), Column("published", Boolean, nullable=False, default=False),
                 Column("version", Integer, nullable=False, default=1), Column("updated_at", String(32), nullable=False))
Index("articles_public_date", articles.c.published, articles.c.date)
media = table("media", Column("name", String(100), primary_key=True),
              Column("mime", String(150), nullable=False), Column("size", Integer, nullable=False),
              Column("created_at", String(32), nullable=False))
applications = table("applications", Column("id", String(36), primary_key=True),
                     Column("number", String(64), unique=True, nullable=False),
                     Column("idempotency_key", String(64), unique=True, nullable=False),
                     Column("payload_hash", String(64), nullable=False),
                     Column("collective", String(180), nullable=False), Column("email", String(254), nullable=False),
                     Column("city", String(120), nullable=False), Column("nomination", String(120), nullable=False),
                     Column("status", String(20), nullable=False, default="new"),
                     Column("notes", Text, nullable=False, default=""), Column("data", body_type, nullable=False),
                     Column("event_snapshot", body_type, nullable=False),
                     Column("version", Integer, nullable=False, default=1),
                     Column("created_at", String(32), nullable=False), Column("updated_at", String(32), nullable=False))
Index("applications_status_date", applications.c.status, applications.c.created_at)
outbox = table("mail_outbox", Column("id", String(36), primary_key=True),
               Column("application_id", String(36), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False),
               Column("recipient", String(254), nullable=False), Column("subject", String(250), nullable=False),
               Column("body", body_type, nullable=False), Column("status", String(20), nullable=False, default="pending"),
               Column("attempts", Integer, nullable=False, default=0), Column("available_at", BigInteger, nullable=False),
               Column("lease_until", BigInteger, nullable=False, default=0), Column("last_error", String(200), nullable=False, default=""))
Index("outbox_due", outbox.c.status, outbox.c.available_at)
schema_version = table("schema_version", Column("id", Integer, primary_key=True), Column("version", Integer, nullable=False))


def timestamp():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def connect(url):
    # Shared hosting has a small connection budget. Never retain idle connections
    # across Passenger workers or fork a connection from the parent process.
    kwargs = {"poolclass": NullPool, "pool_pre_ping": True}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"timeout": 10}
    else:
        kwargs["connect_args"] = {"connect_timeout": 10, "read_timeout": 20, "write_timeout": 20}
    return create_engine(url, **kwargs)


def initialize(engine, defaults):
    metadata.create_all(engine)
    with engine.begin() as conn:
        version = conn.execute(select(schema_version.c.version)).scalar_one_or_none()
        if version is not None and version != 1:
            raise RuntimeError("Unsupported database schema version")
        if version is None:
            conn.execute(schema_version.insert().values(id=1, version=1))
        if conn.execute(select(settings.c.id)).first() is None:
            conn.execute(settings.insert().values(id=1, data=encode(defaults), version=1, updated_at=timestamp()))


def decode_article(row):
    item = dict(row)
    if "sections" in item:
        item["sections"] = json.loads(item["sections"])
    item["published"] = bool(item["published"])
    return item
