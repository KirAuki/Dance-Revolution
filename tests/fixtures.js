import { nominations, ages, levels } from "../shared/application.js";

export const validApplication = {
  collective: "Тестовый коллектив",
  performanceTitle: "Весна",
  participantCount: "5",
  duration: "04:00",
  nomination: nominations[0],
  ageCategory: ages[0],
  professionalLevel: levels[0],
  participants: "Участник 1\nУчастник 2\nУчастник 3\nУчастник 4\nУчастник 5",
  country: "Россия",
  city: "Москва",
  director: "Руководитель",
  teacher: "Педагог",
  accommodation: "Нет",
  email: "test@example.com",
  phone: "+7 999 000-00-00",
  regulationsAccepted: true,
  personalDataAccepted: true,
};
// Created only in the temporary database owned by the browser test run.
export const adminCredentials = {
  login: "qa-editor",
  password: "Local-test-only-not-a-real-account-2027",
};
