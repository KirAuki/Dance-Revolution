export const nominations = [
  "Детский танец",
  "Народный танец",
  "Народный стилизованный танец",
  "Классический танец",
  "Деми-классика",
  "Бально-спортивный танец",
  "Эстрадный танец",
  "Современный танец",
  "Клубный (уличный) танец",
  "Танцевальное шоу",
  "Черлидинг",
  "Восточный танец",
  "Цирковая хореография",
  "Гимнастический танец",
  "Другое направление",
];
export const ages = [
  "5–6 лет",
  "7–9 лет",
  "10–12 лет",
  "13–15 лет",
  "16–18 лет",
  "19 лет и старше",
  "Смешанная",
];
export const levels = [
  "Ансамбль без звания — от 1 до 5 лет",
  "Ансамбль без звания — более 5 лет",
  "Образцовый или заслуженный коллектив",
  "Народный коллектив / школа-студия при государственном ансамбле",
];

export const limits = {
  collective: 180,
  performanceTitle: 180,
  duration: 5,
  nomination: 120,
  ageCategory: 60,
  professionalLevel: 180,
  participants: 8000,
  institution: 240,
  country: 100,
  city: 120,
  director: 180,
  teacher: 180,
  accommodation: 3,
  hotelGuests: 6000,
  email: 254,
  phone: 60,
  telegram: 100,
  comment: 3000,
  website: 200,
};

export const stepFields = [
  [
    "collective",
    "performanceTitle",
    "participantCount",
    "duration",
    "nomination",
    "ageCategory",
    "professionalLevel",
  ],
  [
    "participants",
    "institution",
    "country",
    "city",
    "director",
    "teacher",
    "accommodation",
    "hotelGuests",
  ],
  [
    "email",
    "phone",
    "telegram",
    "comment",
    "regulationsAccepted",
    "personalDataAccepted",
    "mediaAccepted",
    "website",
  ],
];

export function normalizeApplication(body) {
  return Object.fromEntries(
    Object.keys(limits).map((key) => [
      key,
      typeof body[key] === "string" ? body[key].trim() : "",
    ]),
  );
}

export function validateApplication(body) {
  const data = normalizeApplication(body);
  const errors = {};
  const required = [
    "collective",
    "performanceTitle",
    "duration",
    "nomination",
    "ageCategory",
    "professionalLevel",
    "participants",
    "country",
    "city",
    "director",
    "teacher",
    "accommodation",
    "email",
    "phone",
  ];
  for (const key of required) {
    if (!data[key]) errors[key] = "Заполните обязательное поле.";
  }
  for (const [key, limit] of Object.entries(limits)) {
    if (body[key] != null && typeof body[key] !== "string")
      errors[key] = "Ожидается текстовое значение.";
    else if (data[key].length > limit)
      errors[key] = `Допустимо не более ${limit} символов.`;
  }
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(data.email))
    errors.email = "Укажите корректный e-mail.";
  if (
    !/^[+\d\s().-]{7,60}$/.test(data.phone) ||
    data.phone.replace(/\D/g, "").length < 7
  )
    errors.phone = "Укажите корректный телефон.";
  for (const [key, options] of [
    ["nomination", nominations],
    ["ageCategory", ages],
    ["professionalLevel", levels],
    ["accommodation", ["Да", "Нет"]],
  ]) {
    if (!options.includes(data[key]))
      errors[key] = "Выберите значение из списка.";
  }
  if (data.accommodation === "Да" && !data.hotelGuests)
    errors.hotelGuests = "Укажите ФИО всех проживающих.";
  const count = Number(body.participantCount);
  if (
    !["number", "string"].includes(typeof body.participantCount) ||
    !Number.isInteger(count) ||
    count < 5 ||
    count > 500
  ) {
    errors.participantCount =
      "Количество участников должно быть целым числом от 5 до 500.";
  }
  const duration = data.duration.match(/^(\d{1,2}):([0-5]\d)$/);
  const seconds = duration ? Number(duration[1]) * 60 + Number(duration[2]) : 0;
  if (!duration || seconds <= 0 || seconds > 240)
    errors.duration = "Укажите хронометраж в формате 03:30, от 00:01 до 04:00.";
  for (const key of [
    "regulationsAccepted",
    "personalDataAccepted",
    "mediaAccepted",
  ]) {
    if (body[key] !== true) errors[key] = "Необходимо подтвердить согласие.";
  }
  return errors;
}
