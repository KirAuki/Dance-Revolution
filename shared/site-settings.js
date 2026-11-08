import { defaultSitePages, validateSitePages } from "./site-pages.js";

// The same field definitions drive validation and the admin form.
export const settingsGroups = [
  { key: "event", title: "Даты и город", fields: [
    { key: "startDate", label: "Начало конкурса", type: "date" },
    { key: "endDate", label: "Финал и награждение", type: "date" },
    { key: "arrivalDate", label: "Заезд иногородних", type: "date" },
    { key: "departureDate", label: "Выезд иногородних", type: "date" },
    { key: "localDeadline", label: "Заявки от местных коллективов до", type: "date" },
    { key: "travelDeadline", label: "Заявки от иногородних до", type: "date" },
    { key: "city", label: "Город", maxLength: 80 },
    { key: "localLabel", label: "Название местной категории участников", maxLength: 120 },
  ] },
  { key: "prices", title: "Стоимость и премия", fields: [
    { key: "localFirst", label: "Первый номер, ₽ за участника", type: "number", min: 0, max: 10000000 },
    { key: "localAdditional", label: "Следующий номер, ₽ за участника", type: "number", min: 0, max: 10000000 },
    { key: "travelParticipant", label: "Иногородний участник, ₽", type: "number", min: 0, max: 10000000 },
    { key: "companion", label: "Сопровождающий, ₽", type: "number", min: 0, max: 10000000 },
    { key: "premium", label: "Премия в каждой номинации, ₽", type: "number", min: 0, max: 10000000 },
  ] },
  { key: "venue", title: "Площадка", fields: [
    { key: "name", label: "Название площадки", maxLength: 180 },
    { key: "address", label: "Адрес площадки", maxLength: 240 },
    { key: "description", label: "Описание площадки", type: "textarea", maxLength: 1000 },
    { key: "mapUrl", label: "Ссылка на карту", type: "url" },
    { key: "image", label: "Фотография площадки", type: "image" },
  ] },
  { key: "hotel", title: "Проживание", fields: [
    { key: "name", label: "Название гостиницы", maxLength: 180 },
    { key: "address", label: "Адрес гостиницы", maxLength: 240 },
    { key: "roomDescription", label: "Описание номера", maxLength: 180 },
    { key: "meals", label: "Питание", maxLength: 180 },
    { key: "transport", label: "Транспорт", maxLength: 180 },
    { key: "image", label: "Фотография гостиницы", type: "image" },
    { key: "roomImage", label: "Фотография номера", type: "image" },
  ] },
  { key: "contacts", title: "Контакты", fields: [
    { key: "email", label: "E-mail оргкомитета", type: "email" },
    { key: "phone", label: "Телефон оргкомитета", type: "tel" },
    { key: "hours", label: "Время работы", maxLength: 120 },
    { key: "telegramUrl", label: "Ссылка на Telegram", type: "url" },
    { key: "instagramUrl", label: "Ссылка на Instagram", type: "url", optional: true },
    { key: "vkUrl", label: "Ссылка на VK", type: "url", optional: true },
    { key: "maxUrl", label: "Ссылка на MAX", type: "url" },
    { key: "whatsappUrl", label: "Ссылка на WhatsApp", type: "url", optional: true },
  ] },
  { key: "documents", title: "Документы", fields: [
    { key: "regulations", label: "Положение конкурса", type: "document" },
  ] },
  { key: "news", title: "Страница новостей", fields: [
    { key: "title", label: "Заголовок страницы", maxLength: 160 },
    { key: "lead", label: "Вступление", type: "textarea", maxLength: 1000 },
    { key: "emptyTitle", label: "Заголовок, пока нет публикаций", maxLength: 160 },
    { key: "emptyText", label: "Текст, пока нет публикаций", type: "textarea", maxLength: 1000 },
  ] },
];

export const defaultSiteSettings = {
  event: {
    startDate: "2027-07-03", endDate: "2027-07-04",
    arrivalDate: "2027-07-02", departureDate: "2027-07-05",
    localDeadline: "2027-03-29", travelDeadline: "2027-03-22",
    city: "Москва", localLabel: "Москва и Московская область",
  },
  prices: { localFirst: 3500, localAdditional: 3000, travelParticipant: 19500, companion: 16000, premium: 10000 },
  venue: {
    name: "Концертный зал «Останкино»", address: "ул. Академика Королёва, 15, корп. 2",
    description: "Конкурс пройдёт в одном из самых узнаваемых телевизионных районов Москвы.",
    mapUrl: "https://yandex.ru/profile/1053713542?lang=ru",
    image: "/assets/ostankino-venue.webp",
  },
  hotel: {
    name: "«Бета Измайлово» 3*", address: "Измайловское ш., 71, корп. 2Б",
    roomDescription: "Стандартный двухместный номер", meals: "Трёхразовое питание", transport: "Транспортное обслуживание",
    image: "/assets/beta-hotel-day.webp", roomImage: "/assets/beta-hotel-room-v2.webp",
  },
  contacts: {
    email: "dance@revolution-msk.ru", phone: "+7 925 657-77-17", hours: "ежедневно с 11:00 до 20:00",
    telegramUrl: "https://t.me/dancermsk",
    instagramUrl: "https://www.instagram.com/dances.revolution/?hl=ru",
    vkUrl: "https://vk.ru/dancesrevolution",
    maxUrl: "https://max.ru/+79256577717",
    whatsappUrl: "https://wa.me/79256577717",
  },
  documents: { regulations: "/docs/polozhenie-tancevalnaya-revolyutsiya-2027.docx" },
  pages: defaultSitePages,
  news: {
    title: "Новости и статьи",
    lead: "Анонсы конкурса, события и полезные материалы для участников и руководителей коллективов.",
    emptyTitle: "Первые публикации уже впереди.",
    emptyText: "Здесь появятся новости конкурса и полезные материалы для участников.",
  },
  program: [
    {
      title: "Заезд",
      text: "Заезд\nРасселение\nРегистрация\nПланёрка для руководителей и педагогов (ОНЛАЙН)\nУжин",
      note: "",
    },
    {
      title: "Конкурс",
      text: "Завтрак\nТоржественная церемония открытия конкурса\nКонкурсная программа\nПознавательная детская экскурсия «О высоком и не только» в телебашне «Останкино»\nОбед в КЗ «Останкино»\nУжин\nКруглый стол с членами жюри (ОНЛАЙН)",
      note: "",
    },
    {
      title: "Финал",
      text: "Завтрак\nЦеремония награждения и Гала-концерт\nОбед\nУжин",
      note: "Для отъезда в этот день брать обратные билеты после 22:00",
    },
    {
      title: "Выезд",
      text: "Завтрак\nВыселение из отеля до 12:00",
      note: "",
    },
  ],
  jury: [
    { name: "Скоро объявим", role: "Член жюри", bio: "", image: "", spriteIndex: null },
    {
      name: "Ильдар Гайнутдинов", role: "Член жюри",
      bio: "Ведущий солист Театра танца Аллы Духовой TODES, приглашённый солист Большого театра России, неоднократный победитель международных танцевальных телешоу и конкурсов.",
      image: "/assets/jury/ildar.webp", spriteIndex: null,
    },
    {
      name: "Егор Дружинин", role: "Член жюри",
      bio: "Заслуженный артист Российской Федерации, лауреат театральной премии «Золотая Маска», хореограф и режиссёр-постановщик спектаклей и мюзиклов, наставник и член жюри шоу «Танцы» на ТНТ, член жюри проекта «Ты супер! Танцы» на НТВ, педагог по хореографии проекта «Фабрика звёзд» на Первом канале, актёр театра и кино.",
      image: "/assets/jury/druzhinin.webp", spriteIndex: null,
    },
    {
      name: "Дима Щебет", role: "Член жюри",
      bio: "Победитель шоу «Танцы» на ТНТ, победитель чемпионата Volga Champ, основатель и художественный руководитель арт-союза FIZIKA, исполнитель одной из главных ролей в сериале «Искусство падения» (режиссёр-постановщик — Мигель).",
      image: "/assets/jury/shebet.webp", spriteIndex: null,
    },
    { name: "Скоро объявим", role: "Член жюри", bio: "", image: "", spriteIndex: null },
  ],
};

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
  return settings;
}
export const settingsImages = settings => [settings.venue.image, settings.hotel.image, settings.hotel.roomImage, ...settings.jury.map(person => person.image)].filter(Boolean);
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
