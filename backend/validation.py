import copy
import json
import re
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent


def load(name):
    return json.loads((ROOT / "shared" / name).read_text(encoding="utf-8"))


SCHEMA = load("settings-schema.json")
DEFAULTS = load("site-defaults.json")
DEFAULTS["pages"] = load("page-content.json")
DEFAULTS["home"] = load("home-defaults.json")
APPLICATION = load("application-schema.json")
CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
EMAIL = re.compile(r"[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+")
IMAGE = re.compile(r"(?:/assets/[a-zA-Z0-9/_-]+\.(?:webp|png|jpg|jpeg)|/media/[a-f0-9-]{36}\.(?:webp|png|jpg))")
DOCUMENT = re.compile(r"(?:/docs/[a-zA-Z0-9_-]+|/documents/[a-f0-9-]{36})\.(?:pdf|docx)")


class Problem(Exception):
    def __init__(self, status, message):
        self.status = status
        self.message = message


def check(condition, message, status=422):
    if not condition:
        raise Problem(status, message)


def text(value, label, maximum=2048, optional=False):
    check(isinstance(value, str), f"Проверьте поле «{label}».")
    value = value.strip()
    check((optional or bool(value)) and len(value) <= maximum and not CONTROL.search(value), f"Проверьте поле «{label}».")
    return value


def valid_date(value):
    try:
        return isinstance(value, str) and bool(re.fullmatch(r"20\d{2}-\d{2}-\d{2}", value)) and date.fromisoformat(value).isoformat() == value
    except ValueError:
        return False


def field(value, spec):
    label, kind = spec.get("label", spec.get("key", "значение")), spec.get("type", "text")
    message = f"Проверьте поле «{label}»."
    if kind == "number":
        check(type(value) is int and spec.get("min", 0) <= value <= spec.get("max", 10000000), message)
        return value
    value = text(value if value is not None else "", label, spec.get("maxLength", 2048), spec.get("optional", False))
    if not value and spec.get("optional"):
        return value
    if kind == "date":
        check(valid_date(value), message)
    elif kind == "email":
        check(len(value) <= 254 and EMAIL.fullmatch(value), message)
    elif kind == "tel":
        check(len(value) <= 40 and re.fullmatch(r"\+?[\d\s()\-]+", value) and len(re.sub(r"\D", "", value)) >= 7, message)
    elif kind == "url":
        try:
            url = urlsplit(value)
            check(url.scheme == "https" and url.hostname and not url.username and not url.password and not re.search(r"[\s\\]", value), message)
        except ValueError:
            raise Problem(422, message)
    elif kind == "image":
        check(IMAGE.fullmatch(value), message)
    elif kind == "document":
        check(DOCUMENT.fullmatch(value), message)
    return value


def list_of(value, minimum, maximum, label):
    check(isinstance(value, list) and minimum <= len(value) <= maximum, f"Проверьте список «{label}».")
    check(all(isinstance(item, dict) for item in value), f"Проверьте список «{label}».")
    return value


def merge_defaults(saved, defaults=None):
    defaults = DEFAULTS if defaults is None else defaults
    result = copy.deepcopy(defaults)
    for key, value in saved.items():
        result[key] = merge_defaults(value, defaults[key]) if isinstance(value, dict) and isinstance(defaults.get(key), dict) else copy.deepcopy(value)
    for key in ("tracksEmail", "telegramLabel", "maxLabel", "instagramUrl", "whatsappUrl"):
        if isinstance(result.get("contacts"), dict):
            result["contacts"].pop(key, None)
    return result


def validate_settings(value):
    check(isinstance(value, dict), "Настройки не переданы.")
    for group in SCHEMA:
        if group["key"] in ("news", "seo") and group["key"] not in value:
            continue
        source = value.get(group["key"])
        check(isinstance(source, dict), "Некорректный раздел настроек.")
        for spec in group["fields"]:
            check(spec.get("optional") or spec["key"] in source, f'Проверьте поле «{spec["label"]}».')
    value = merge_defaults(value)
    result = {}
    for group in SCHEMA:
        source = value.get(group["key"])
        check(isinstance(source, dict), "Некорректный раздел настроек.")
        result[group["key"]] = {spec["key"]: field(source.get(spec["key"]), spec) for spec in group["fields"]}
    event = result["event"]
    for key in ("googleVerification", "yandexVerification"):
        check(not result["seo"][key] or re.fullmatch(r"[a-zA-Z0-9_-]+", result["seo"][key]), "Вставьте только код подтверждения, без HTML-тега.")
    check(event["arrivalDate"] <= event["startDate"] <= event["endDate"] <= event["departureDate"], "Заезд должен быть не позже начала конкурса, а выезд — не раньше финала.")
    check(event["localDeadline"] <= event["startDate"] and event["travelDeadline"] <= event["startDate"], "Приём заявок должен завершаться не позже начала конкурса.")
    check((date.fromisoformat(event["departureDate"]) - date.fromisoformat(event["arrivalDate"])).days <= 30, "Программа с проживанием не должна превышать 31 день.")
    result["program"] = [{"title": text(item.get("title"), "Название этапа", 80), "text": text(item.get("text"), "Описание этапа", 1000), "note": text(item.get("note", ""), "Примечание", 500, True)} for item in list_of(value.get("program"), 4, 4, "Программа")]
    result["jury"] = []
    for item in list_of(value.get("jury"), 1, 12, "Жюри"):
        image = item.get("image", "")
        check(isinstance(image, str) and (not image or IMAGE.fullmatch(image)), "Загрузите фотографию жюри.")
        result["jury"].append({"name": text(item.get("name"), "Имя", 120), "role": text(item.get("role"), "Должность", 180), "bio": text(item.get("bio", ""), "Описание", 1000, True), "image": image, "spriteIndex": None})
    result["pages"] = {}
    check(isinstance(value.get("pages"), dict), "Проверьте страницы документов.")
    for key in ("privacy", "consent", "cookies"):
        page = value["pages"].get(key)
        check(isinstance(page, dict), "Проверьте страницу документа.")
        result["pages"][key] = {"title": text(page.get("title"), "Заголовок", 160), "lead": text(page.get("lead"), "Вступление", 2000), "sections": [{"heading": text(s.get("heading"), "Название раздела", 160), "text": text(s.get("text"), "Текст раздела", 3000)} for s in list_of(page.get("sections"), 1, 20, "Разделы документа")]}
    if "home" in DEFAULTS:
        result["home"] = validate_home(value.get("home"))
    return result


def validate_home(value):
    check(isinstance(value, dict), "Заполните блоки сайта.")
    result = {}
    for block in load("home-schema.json"):
        source = value.get(block["key"], {})
        check(isinstance(source, dict), "Проверьте блок сайта.")
        result[block["key"]] = {spec["key"]: field(source.get(spec["key"]), spec) for spec in block.get("fields", [])}
        for spec in block.get("lists", []):
            entries = list_of(source.get(spec["key"]), spec.get("min", 1), spec.get("max", 30), spec["label"])
            result[block["key"]][spec["key"]] = [{f["key"]: field(item.get(f["key"]), f) for f in spec["fields"]} for item in entries]
    registration = result.get("registration", {})
    check(registration.get("minParticipants", 5) <= registration.get("maxParticipants", 500), "Минимум участников не может превышать максимум.")
    return result


def validate_article(value):
    check(isinstance(value, dict), "Некорректная публикация.")
    result = {key: text(value.get(key), label, maximum) for key, label, maximum in [("slug", "Адрес", 100), ("title", "Заголовок", 200), ("description", "Описание", 600), ("category", "Рубрика", 60)]}
    check(re.fullmatch(r"(?!index$)[a-z0-9]+(?:-[a-z0-9]+)*", result["slug"]), "Некорректный адрес статьи.")
    check(valid_date(value.get("date")) and type(value.get("published")) is bool, "Укажите корректную дату и статус публикации.")
    result.update(date=value["date"], published=value["published"], image=value.get("image") or "")
    check(isinstance(result["image"], str) and (not result["image"] or IMAGE.fullmatch(result["image"])), "Загрузите обложку через редактор.")
    result["sections"] = []
    for section in list_of(value.get("sections"), 1, 30, "Разделы статьи"):
        paragraphs = section.get("paragraphs")
        check(isinstance(paragraphs, list) and 1 <= len(paragraphs) <= 100, "Заполните абзацы статьи.")
        result["sections"].append({"heading": text(section.get("heading", ""), "Подзаголовок", 200, True), "paragraphs": [text(p, "Абзац", 10000) for p in paragraphs]})
    return result


def validate_application(value, settings):
    data = {key: text(value.get(key, ""), key, maximum, True) for key, maximum in APPLICATION["limits"].items()}
    for key in ["collective", "performanceTitle", "duration", "nomination", "ageCategory", "professionalLevel", "participants", "country", "city", "director", "teacher", "accommodation", "email", "phone"]:
        check(data[key], "Заполните обязательные поля заявки.")
    check(EMAIL.fullmatch(data["email"]), "Укажите корректный e-mail.")
    check(re.fullmatch(r"[+\d\s().-]{7,60}", data["phone"]) and len(re.sub(r"\D", "", data["phone"])) >= 7, "Укажите корректный телефон.")
    home = settings.get("home", {})
    choices = {"nomination": [i["title"] for i in home.get("nominations", {}).get("items", [])] or APPLICATION["nominations"], "ageCategory": [i["title"] for i in home.get("categories", {}).get("ages", [])] or APPLICATION["ages"], "professionalLevel": [i["title"] for i in home.get("categories", {}).get("levels", [])] or APPLICATION["levels"], "accommodation": ["Да", "Нет"]}
    for key, options in choices.items():
        check(data[key] in options, "Выберите значение из списка.")
    check(data["accommodation"] != "Да" or data["hotelGuests"], "Укажите ФИО всех проживающих.")
    rules = home.get("registration", {})
    count = value.get("participantCount")
    check(type(count) in (int, str) and re.fullmatch(r"\d{1,10}", str(count)), "Проверьте количество участников.")
    count = int(count)
    check(rules.get("minParticipants", 5) <= count <= rules.get("maxParticipants", 500), "Количество участников вне допустимого диапазона.")
    duration = re.fullmatch(r"(\d{1,2}):([0-5]\d)", data["duration"])
    check(duration and 0 < int(duration[1]) * 60 + int(duration[2]) <= rules.get("maxDurationSeconds", 240), "Проверьте хронометраж номера.")
    for key in ("regulationsAccepted", "personalDataAccepted"):
        check(value.get(key) is True, "Необходимо подтвердить согласие.")
        data[key] = True
    data["participantCount"] = count
    data.pop("website", None)
    return data


def settings_images(value):
    images = [value.get("seo", {}).get("image"), value["venue"]["image"], value["hotel"]["image"], value["hotel"]["roomImage"], *[p["image"] for p in value["jury"]]]
    for block in load("home-schema.json") if "home" in value else []:
        group = value["home"][block["key"]]
        images.extend(group[f["key"]] for f in block.get("fields", []) if f.get("type") == "image")
        for spec in block.get("lists", []):
            for item in group[spec["key"]]:
                images.extend(item[f["key"]] for f in spec["fields"] if f.get("type") == "image")
    return list(filter(None, images))
