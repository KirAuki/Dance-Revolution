import os
import smtplib
import ssl
import time
from email.message import EmailMessage
from sqlalchemy import select, update, or_, and_
from .db import outbox


def deliver(engine, maximum=20, send=None):
    """Cron worker. Claims each message before network IO; SMTP is at-least-once."""
    host, sender = os.environ.get("SMTP_HOST"), os.environ.get("SMTP_FROM")
    if send is None and (not host or not sender):
        return {"sent": 0, "failed": 0, "configured": False}
    result = {"sent": 0, "failed": 0, "configured": True}
    # A killed worker on the final attempt must not leave a message in
    # "sending" forever; expose it as failed so an operator can retry it.
    with engine.begin() as conn:
        conn.execute(update(outbox).where(outbox.c.status == "sending", outbox.c.attempts >= 8,
                     outbox.c.lease_until < int(time.time())).values(status="failed", lease_until=0, last_error="InterruptedDelivery"))
    for _ in range(maximum):
        now = int(time.time())
        due = or_(and_(outbox.c.status.in_(["pending", "retry"]), outbox.c.available_at <= now), and_(outbox.c.status == "sending", outbox.c.lease_until < now))
        with engine.begin() as conn:
            row = conn.execute(select(outbox).where(due, outbox.c.attempts < 8).order_by(outbox.c.available_at).limit(1)).mappings().first()
            if row is None:
                break
            claimed = conn.execute(update(outbox).where(outbox.c.id == row["id"], due, outbox.c.attempts == row["attempts"]).values(status="sending", lease_until=now + 300, attempts=outbox.c.attempts + 1))
            if not claimed.rowcount:
                continue
        message = EmailMessage()
        message["From"] = sender or "test@example.com"
        message["To"] = row["recipient"]
        message["Subject"] = row["subject"]
        message["Message-ID"] = f'<{row["id"]}@{(sender or "test@example.com").split("@")[-1].rstrip(">") }>'
        message.set_content(row["body"])
        try:
            if send:
                send(message)
            else:
                mode = os.environ.get("SMTP_SECURITY", "ssl")
                if mode not in ("ssl", "starttls"):
                    raise ValueError("SMTP_SECURITY must be ssl or starttls")
                port = int(os.environ.get("SMTP_PORT", "465" if mode == "ssl" else "587"))
                client = smtplib.SMTP_SSL(host, port, timeout=20, context=ssl.create_default_context()) if mode == "ssl" else smtplib.SMTP(host, port, timeout=20)
                with client:
                    if mode == "starttls":
                        client.starttls(context=ssl.create_default_context())
                    if os.environ.get("SMTP_USER"):
                        client.login(os.environ["SMTP_USER"], os.environ.get("SMTP_PASSWORD", ""))
                    client.send_message(message)
            status, error = "sent", ""
            result["sent"] += 1
        except Exception as exc:
            status = "failed" if row["attempts"] + 1 >= 8 else "retry"
            error = type(exc).__name__  # SMTP responses can contain email addresses.
            result["failed"] += 1
        with engine.begin() as conn:
            conn.execute(update(outbox).where(outbox.c.id == row["id"]).values(status=status, last_error=error, lease_until=0, available_at=int(time.time()) + min(3600, 60 * (2 ** row["attempts"]))))
    return result
