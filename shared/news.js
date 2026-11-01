export function publishedArticles(articles) {
  return articles
    .filter((article) => article.published === true)
    .toSorted((a, b) => b.date.localeCompare(a.date));
}

export function articleUrl(article) {
  return `/news/${article.slug}`;
}

export function formatArticleDate(date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function validateArticles(articles) {
  if (!Array.isArray(articles))
    throw new Error("Article data must be an array.");
  const slugs = new Set();
  for (const article of articles) {
    if (
      !article ||
      typeof article.slug !== "string" ||
      article.slug.length > 100 ||
      !/^(?!index$)[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug) ||
      slugs.has(article.slug)
    ) {
      throw new Error(
        "Адрес статьи: до 100 символов, маленькие латинские буквы, цифры и дефисы. Адрес index зарезервирован.",
      );
    }
    slugs.add(article.slug);
    const timestamp = Date.parse(`${article.date}T00:00:00Z`);
    if (
      typeof article.published !== "boolean" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(article.date) ||
      !Number.isFinite(timestamp) ||
      new Date(timestamp).toISOString().slice(0, 10) !== article.date
    ) {
      throw new Error("Укажите корректную дату публикации и статус записи.");
    }
    for (const [key, label, max] of [
      ["title", "Заголовок", 200],
      ["description", "Краткое описание", 600],
      ["category", "Рубрика", 60],
    ]) {
      if (
        typeof article[key] !== "string" ||
        !article[key].trim() ||
        article[key].length > max
      )
        throw new Error(`${label}: заполните поле, не более ${max} символов.`);
    }
    if (
      article.image &&
      !(
        typeof article.image === "string" &&
        (/^\/assets\/[a-zA-Z0-9/_-]+\.(?:webp|png|jpe?g)$/i.test(
          article.image,
        ) ||
          /^\/media\/[a-f0-9-]{36}\.(?:webp|png|jpg)$/.test(article.image))
      )
    ) {
      throw new Error("Используйте обложку, загруженную через редактор.");
    }
    if (
      !Array.isArray(article.sections) ||
      !article.sections.length ||
      article.sections.length > 30
    )
      throw new Error("Добавьте текст статьи (от 1 до 30 разделов).");
    for (const section of article.sections) {
      if (
        !section ||
        (section.heading != null &&
          (typeof section.heading !== "string" ||
            section.heading.length > 200)) ||
        !Array.isArray(section.paragraphs) ||
        !section.paragraphs.length ||
        section.paragraphs.length > 100 ||
        section.paragraphs.some(
          (text) =>
            typeof text !== "string" || !text.trim() || text.length > 10000,
        )
      ) {
        throw new Error(
          "Заполните текст каждого раздела. Подзаголовок — до 200 символов, абзац — до 10 000 символов.",
        );
      }
    }
  }
  return articles;
}
