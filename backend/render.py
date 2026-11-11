import html
import json
import re
from datetime import date
from urllib.parse import urljoin
from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup
from .validation import ROOT, DEFAULTS

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


def homepage_seo(settings):
    seo = settings.get("seo", DEFAULTS["seo"])
    tokens = {"dates": event_range(settings["event"]), "city": settings["event"]["city"],
              "venue": settings["venue"]["name"], "year": settings["event"]["startDate"][:4]}
    expand = lambda value: re.sub(r"\{(dates|city|venue|year)\}", lambda match: tokens[match[1]], value)
    return {"title": expand(seo["title"]), "description": expand(seo["description"]), "image": seo["image"]}


def site_shell(template, settings, origin, articles=()):
    seo = homepage_seo(settings)
    title, description = seo["title"], seo["description"]
    template = re.sub(r"<title>[^<]*</title>", lambda _: f"<title>{html.escape(title)}</title>", template)
    template = re.sub(r'<meta\s+name="description"\s+content="[^"]*"\s*/?>', lambda _: f'<meta name="description" content="{html.escape(description, quote=True)}">', template)
    template = re.sub(r'<a data-contact-email[^>]*>.*?</a>', lambda _: f'<a data-contact-email href="mailto:{html.escape(settings["contacts"]["email"])}">{html.escape(settings["contacts"]["email"])}</a>', template, flags=re.S)
    template = re.sub(r'<link rel="canonical"[^>]*>', "", template)
    # The same readable HTML is sent to visitors and crawlers, then React enhances it.
    content = env.get_template("home-content.html").render(settings=settings, articles=articles, dates=event_range(settings["event"]))
    template = template.replace('<div id="root"></div>', '<div id="root">' + content + '</div>')
    # Keep the first image in sync with the poster selected in the admin panel.
    template = re.sub(r'<link\b(?=[^>]*rel="preload")(?=[^>]*as="image")[^>]*>',
                      lambda _: f'<link rel="preload" as="image" href="{html.escape(settings["home"]["hero"]["poster"], quote=True)}">', template)
    canonical = origin + "/"
    graph = [
        {"@type": "WebSite", "@id": canonical + "#website", "name": "Танцевальная революция", "url": canonical, "inLanguage": "ru-RU"},
        {"@type": "Organization", "@id": canonical + "#organizer", "name": settings["home"]["footer"]["organizer"],
         "url": canonical, "email": settings["contacts"]["email"], "telephone": settings["contacts"]["phone"],
         "sameAs": [settings["contacts"][key] for key in ("telegramUrl", "vkUrl", "maxUrl") if settings["contacts"].get(key)]},
        {"@type": "DanceEvent", "@id": canonical + "#event", "name": "Танцевальная революция", "url": canonical,
         "description": settings["home"]["hero"]["eyebrow"] + ". " + settings["home"]["hero"]["lead"],
         "startDate": settings["event"]["startDate"], "endDate": settings["event"]["endDate"],
         "eventStatus": "https://schema.org/EventScheduled", "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
         "image": [urljoin(canonical, seo["image"])], "organizer": {"@id": canonical + "#organizer"},
         "location": {"@type": "Place", "name": settings["venue"]["name"], "address": {"@type": "PostalAddress",
                      "streetAddress": settings["venue"]["address"], "addressLocality": settings["event"]["city"], "addressCountry": "RU"}}},
    ]
    metadata = env.get_template("home-meta.html").render(seo=seo, settings=settings, canonical=canonical,
                  image=urljoin(canonical, seo["image"]), schema=Markup(safe_json({"@context": "https://schema.org", "@graph": graph})))
    return template.replace("</head>", f'{metadata}<script type="application/json" id="site-settings">{safe_json(settings)}</script></head>')


def page(kind, settings, origin, styles, **values):
    title = values.get("title") or (values["article"]["title"] if kind == "article" else settings["news"]["title"])
    description = values.get("description") or values.get("article", {}).get("description") or settings["news"]["lead"]
    pathname = values.get("pathname", "/news")
    article = values.get("article")
    schema = None
    image = urljoin(origin + "/", (article or {}).get("image") or settings["seo"]["image"])
    if article:
        schema = safe_json({"@context": "https://schema.org", "@type": "Article", "headline": article["title"], "description": article["description"], "datePublished": article["date"],
                            "dateModified": article.get("updated_at", article["date"]), "mainEntityOfPage": origin + pathname,
                            "publisher": {"@type": "Organization", "name": "Танцевальная революция", "url": origin + "/"}, "image": image})
    return env.get_template("page.html").render(kind=kind, settings=settings, origin=origin, styles=Markup(styles), title=title, description=description, canonical=origin + pathname, share_image=image, schema=Markup(schema) if schema else None, **{key: value for key, value in values.items() if key not in ("title", "description")})
