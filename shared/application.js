import schema from "./application-schema.json" with { type: "json" };
export const { nominations, ages, levels, limits, stepFields } = schema;

export function normalizeApplication(body) {
  return Object.fromEntries(
    Object.keys(limits).map((key) => [
      key,
      typeof body[key] === "string" ? body[key].trim() : "",
    ]),
  );
}

export function applicationOptions(home) {
  return {
    nominations: home?.nominations.items.map(item => item.title) ?? nominations,
    ages: home?.categories.ages.map(item => item.title) ?? ages,
    levels: home?.categories.levels.map(item => item.title) ?? levels,
    minParticipants: home?.registration.minParticipants ?? 5,
    maxParticipants: home?.registration.maxParticipants ?? 500,
    maxDurationSeconds: home?.registration.maxDurationSeconds ?? 240,
  };
}

export function validateApplication(body, home) {
  const options = applicationOptions(home);
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
  for (const [key, choices] of [
    ["nomination", options.nominations],
    ["ageCategory", options.ages],
    ["professionalLevel", options.levels],
    ["accommodation", ["Да", "Нет"]],
  ]) {
    if (!choices.includes(data[key]))
      errors[key] = "Выберите значение из списка.";
  }
  if (data.accommodation === "Да" && !data.hotelGuests)
    errors.hotelGuests = "Укажите ФИО всех проживающих.";
  const count = Number(body.participantCount);
  if (
    !["number", "string"].includes(typeof body.participantCount) ||
    !Number.isInteger(count) ||
    count < options.minParticipants ||
    count > options.maxParticipants
  ) {
    errors.participantCount =
      `Количество участников должно быть целым числом от ${options.minParticipants} до ${options.maxParticipants}.`;
  }
  const duration = data.duration.match(/^(\d{1,2}):([0-5]\d)$/);
  const seconds = duration ? Number(duration[1]) * 60 + Number(duration[2]) : 0;
  if (!duration || seconds <= 0 || seconds > options.maxDurationSeconds)
    errors.duration = "Укажите длительность больше нуля и не более допустимого времени. Секунды — от 0 до 59.";
  for (const key of ["regulationsAccepted", "personalDataAccepted"]) {
    if (body[key] !== true) errors[key] = "Необходимо подтвердить согласие.";
  }
  return errors;
}
