import initialPages from "./page-content.json" with { type: "json" };

export const defaultSitePages = initialPages;
export const pageDefinitions = [
  { key: "privacy", label: "Политика конфиденциальности" },
  { key: "consent", label: "Согласие на обработку ПД" },
  { key: "cookies", label: "Использование cookies" },
];

export function validateSitePages(input) {
  const text = (value, label, maxLength) => {
    if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))
      throw new Error(`Проверьте поле «${label}» на странице документа.`);
    return value.trim();
  };
  return Object.fromEntries(pageDefinitions.map(({ key, label }) => {
    // Settings saved before the cookies page was added remain editable.
    const page = key === "cookies" && input?.cookies === undefined ? initialPages.cookies : input?.[key];
    if (!Array.isArray(page?.sections) || page.sections.length < 1 || page.sections.length > 20)
      throw new Error(`На странице «${label}» должно быть от 1 до 20 разделов.`);
    return [key, {
      title: text(page.title, "Заголовок", 160),
      lead: text(page.lead, "Вступление", 2000),
      sections: page.sections.map(section => ({
        heading: text(section?.heading, "Название раздела", 160),
        text: text(section?.text, "Текст раздела", 3000),
      })),
    }];
  }));
}
