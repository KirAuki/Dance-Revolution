import { defaultSitePages, validateSitePages } from "./site-pages.js";

import schema from "./settings-schema.json" with { type: "json" };
import defaults from "./site-defaults.json" with { type: "json" };
import homeDefaults from "./home-defaults.json" with { type: "json" };
import homeSchema from "./home-schema.json" with { type: "json" };

export const settingsGroups = schema;
export const homeBlocks = homeSchema;
export const defaultSiteSettings = { ...defaults, pages: defaultSitePages, home: homeDefaults };

export function validDate(value) {
  if (typeof value !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validImage(value) {
  return typeof value === "string" && /^(?:\/assets\/[a-zA-Z0-9/_-]+\.(?:webp|png|jpg|jpeg)|\/media\/[a-f0-9-]{36}\.(?:webp|png|jpg))$/.test(value);
}
export function validDocument(value) {
  return typeof value === "string" && /^(?:\/docs\/[a-zA-Z0-9_-]+|\/documents\/[a-f0-9-]{36})\.(?:pdf|docx)$/.test(value);
}
function fieldValue(value, field) {
  const fail = () => { throw new Error(`Проверьте поле «${field.label}».`); };
  if (field.type === "number") {
    if (!Number.isSafeInteger(value) || value < field.min || value > field.max) fail();
    return value;
  }
  if (typeof value !== "string") fail();
  value = value.trim();
  if (!value && field.optional) return "";
  if (!value || value.length > (field.maxLength || 2048) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail();
  if (field.type === "date" && !validDate(value)) fail();
  if (field.type === "email" && (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value) || value.length > 254)) fail();
  if (field.type === "tel" && (!/^\+?[\d\s()\-]+$/.test(value) || value.replace(/\D/g, "").length < 7 || value.length > 40)) fail();
  if (field.type === "image" && !validImage(value)) fail();
  if (field.type === "document" && !validDocument(value)) fail();
  if (field.type === "url") {
    let url;
    try { url = new URL(value); } catch { fail(); }
    if (url.protocol !== "https:" || url.username || url.password) fail();
  }
  return value;
}
export function validateSiteSettings(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Настройки не переданы.");
  // Older records have no editable pages yet.
  input = { ...input, news: input.news === undefined ? defaultSiteSettings.news : input.news };
  const settings = {};
  for (const group of settingsGroups) {
    settings[group.key] = {};
    for (const field of group.fields) {
      const value = input[group.key]?.[field.key];
      settings[group.key][field.key] = fieldValue(value === undefined && field.optional ? "" : value, field);
    }
  }
  const event = settings.event;
  if (event.startDate > event.endDate || event.arrivalDate > event.startDate || event.departureDate < event.endDate)
    throw new Error("Заезд должен быть не позже начала конкурса, а выезд — не раньше финала.");
  if (event.localDeadline > event.startDate || event.travelDeadline > event.startDate)
    throw new Error("Приём заявок должен завершаться не позже начала конкурса.");
  if (daysBetween(event.arrivalDate, event.departureDate) > 30)
    throw new Error("Программа с проживанием не должна превышать 31 день.");
  if (!Array.isArray(input.program) || input.program.length !== 4) throw new Error("В программе должны быть четыре этапа.");
  settings.program = input.program.map(item => ({
    title: fieldValue(item?.title, { label: "Название этапа программы", maxLength: 80 }),
    text: fieldValue(item?.text, { label: "Описание этапа программы", maxLength: 1000 }),
    // Existing settings records predate the optional notice.
    note: fieldValue(item?.note ?? "", { label: "Важное примечание к этапу", maxLength: 500, optional: true }),
  }));
  if (!Array.isArray(input.jury) || input.jury.length < 1 || input.jury.length > 12) throw new Error("Укажите от 1 до 12 членов жюри.");
  settings.jury = input.jury.map(item => {
    if (item?.image !== "" && !validImage(item?.image)) throw new Error("Загрузите фотографию члена жюри.");
    if (item.spriteIndex !== null && (!Number.isInteger(item.spriteIndex) || item.spriteIndex < 0 || item.spriteIndex > 4)) throw new Error("Некорректная фотография жюри.");
    return {
      name: fieldValue(item.name, { label: "Имя члена жюри", maxLength: 120 }),
      role: fieldValue(item.role, { label: "Должность члена жюри", maxLength: 180 }),
      bio: fieldValue(item.bio, { label: "Описание члена жюри", maxLength: 1000, optional: true }),
      image: item.image, spriteIndex: item.spriteIndex,
    };
  });
  settings.pages = validateSitePages(input.pages === undefined ? defaultSitePages : input.pages);
  const home = input.home ?? homeDefaults;
  settings.home = Object.fromEntries(homeBlocks.map(block => {
    const source = home[block.key] ?? homeDefaults[block.key];
    const value = Object.fromEntries(block.fields.map(field => [field.key, fieldValue(source[field.key], field)]));
    for (const list of block.lists) {
      if (!Array.isArray(source[list.key]) || source[list.key].length < list.min || source[list.key].length > list.max)
        throw new Error(`Проверьте список «${list.label}».`);
      value[list.key] = source[list.key].map(item => Object.fromEntries(list.fields.map(field => [field.key, fieldValue(item[field.key], field)])));
    }
    return [block.key, value];
  }));
  if (settings.home.registration.minParticipants > settings.home.registration.maxParticipants)
    throw new Error("Минимум участников не может превышать максимум.");
  return settings;
}
export const settingsImages = settings => [settings.venue.image, settings.hotel.image, settings.hotel.roomImage, ...settings.jury.map(person => person.image), ...homeBlocks.flatMap(block => {
  const source = (settings.home ?? homeDefaults)[block.key];
  return [...block.fields.filter(f => f.type === "image").map(f => source[f.key]), ...block.lists.flatMap(list => source[list.key].flatMap(item => list.fields.filter(f => f.type === "image").map(f => item[f.key])))];
})].filter(Boolean);
export function homeText(value, settings) {
  const tokens = {awardDate: eventDate(settings.event.endDate), minParticipants: settings.home.registration.minParticipants};
  return value.replace(/\{(awardDate|minParticipants)\}/g, (_, key) => tokens[key]);
}
export const daysBetween = (start, end) => Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86400000);
export function countLabel(count, forms) {
  const remainder = count % 100;
  return `${count} ${forms[remainder >= 11 && remainder <= 14 ? 2 : count % 10 === 1 ? 0 : count % 10 >= 2 && count % 10 <= 4 ? 1 : 2]}`;
}
export function dayCount(start, end, words = false) {
  const count = daysBetween(start, end) + 1;
  const label = countLabel(count, ["день", "дня", "дней"]);
  return words && count <= 4 ? label.replace(/^\d+/, ["", "Один", "Два", "Три", "Четыре"][count]) : label;
}
export const money = value => `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
export const phoneHref = value => `tel:${value.replace(/[^+\d]/g, "")}`;
export function eventDate(value, { year = false, padded = false } = {}) {
  return new Intl.DateTimeFormat("ru-RU", { day: padded ? "2-digit" : "numeric", month: "long", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" })
    .format(new Date(`${value}T12:00:00Z`)).replace(/\s*г\.$/, "");
}
export function eventRange(start, end) {
  if (start === end) return eventDate(start, {year: true});
  if (start.slice(0, 7) === end.slice(0, 7)) return `${Number(start.slice(8))}–${eventDate(end, {year: true})}`;
  return `${eventDate(start, {year: start.slice(0, 4) !== end.slice(0, 4)})} — ${eventDate(end, {year: true})}`;
}
export function compactEventDates(start, end) {
  if (start.slice(0, 7) === end.slice(0, 7)) return [start === end ? start.slice(8) : `${start.slice(8)}–${end.slice(8)}`, `${start.slice(5, 7)}·${start.slice(0, 4)}`];
  const numeric = value => `${value.slice(8)}.${value.slice(5, 7)}.${value.slice(0, 4)}`;
  return [numeric(start), numeric(end)];
}
