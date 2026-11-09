import html
import json
import re
from datetime import date
from urllib.parse import urljoin
from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup
from .validation import ROOT

env = Environment(loader=FileSystemLoader(ROOT / "backend" / "templates"), autoescape=select_autoescape(["html"]))
MONTHS = ["", "января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]


def date_label(value, year=True):
    value = date.fromisoformat(value)
    return f"{value.day} {MONTHS[value.month]}" + (f" {value.year}" if year else "")


def event_range(event):
    start, end = event["startDate"], event["endDate"]
    if start == end:
        return date_label(end)
    if start[:7] == end[:7]:
        return f"{int(start[8:])}–{date_label(end)}"
    return f"{date_label(start, start[:4] != end[:4])} — {date_label(end)}"


def safe_json(value):
    return json.dumps(value, ensure_ascii=False).replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


def inline(value, settings):
    links = {"email": (settings["contacts"]["email"], "mailto:" + settings["contacts"]["email"]),
             "phone": (settings["contacts"]["phone"], "tel:" + re.sub(r"[^+\d]", "", settings["contacts"]["phone"])),
             "privacy": ("Политикой конфиденциальности", "/privacy"),
             "regulations": ("Положением конкурса", settings["documents"]["regulations"])}
    def replace(match):
        label, href = links[match[1]]
        return f'<a href="{html.escape(href, quote=True)}">{html.escape(label)}</a>'
    return Markup(re.sub(r"\{(email|phone|privacy|regulations)\}", replace, html.escape(value)))


env.filters["date_label"] = date_label
env.filters["paragraphs"] = lambda value: re.split(r"\r?\n\s*\r?\n", value)
env.globals["inline"] = inline


def site_shell(template, settings, origin):
    dates = event_range(settings["event"])
    title = f'Танцевальная революция — {dates}, {settings["event"]["city"]}'
    description = settings.get("home", {}).get("hero", {}).get("lead", "Международная премия-конкурс в сфере хореографического искусства.")
    template = re.sub(r"<title>[^<]*</title>", lambda _: f"<title>{html.escape(title)}</title>", template)
    template = re.sub(r'<meta\s+name="description"\s+content="[^"]*"\s*/?>', lambda _: f'<meta name="description" content="{html.escape(description, quote=True)}">', template)
    template = re.sub(r'<a data-contact-email[^>]*>.*?</a>', lambda _: f'<a data-contact-email href="mailto:{html.escape(settings["contacts"]["email"])}">{html.escape(settings["contacts"]["email"])}</a>', template, flags=re.S)
    template = re.sub(r'<link rel="canonical"[^>]*>', "", template)
    return template.replace("</head>", f'<link rel="canonical" href="{html.escape(origin, quote=True)}/"><script type="application/json" id="site-settings">{safe_json(settings)}</script></head>')


def page(kind, settings, origin, styles, **values):
    title = values.get("title") or (values["article"]["title"] if kind == "article" else settings["news"]["title"])
    description = values.get("description") or values.get("article", {}).get("description") or settings["news"]["lead"]
    pathname = values.get("pathname", "/news")
    article = values.get("article")
    schema = None
    if article:
        schema = safe_json({"@context": "https://schema.org", "@type": "Article", "headline": article["title"], "description": article["description"], "datePublished": article["date"], "mainEntityOfPage": origin + pathname, "publisher": {"@type": "Organization", "name": "Танцевальная революция"}, **({"image": urljoin(origin, article["image"])} if article.get("image") else {})})
    return env.get_template("page.html").render(kind=kind, settings=settings, origin=origin, styles=Markup(styles), title=title, description=description, canonical=origin + pathname, schema=Markup(schema) if schema else None, **{key: value for key, value in values.items() if key not in ("title", "description")})
