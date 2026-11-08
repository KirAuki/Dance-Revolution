import { articleUrl, formatArticleDate } from "./news.js";
import { defaultSiteSettings } from "./site-settings.js";

import { documentPage, escapeHtml as escape, arrowIcon, backArrowIcon } from "./page-html.js";

function renderBreadcrumbs(currentPage) {
  const items = [
    { label: "Главная", href: "/" },
    { label: "Новости и статьи", href: currentPage ? "/news" : undefined },
    ...(currentPage ? [{ label: currentPage }] : []),
  ];
  return `<nav class="page-breadcrumbs" aria-label="Хлебные крошки"><ol>${items
    .map(
      (item, index) =>
        `<li>${index ? '<span class="page-breadcrumbs__separator" aria-hidden="true">/</span>' : ""}${item.href ? `<a href="${escape(item.href)}">${index === 0 ? backArrowIcon : ""}${escape(item.label)}</a>` : `<span aria-current="page">${escape(item.label)}</span>`}</li>`,
    )
    .join("")}</ol></nav>`;
}

export function renderArticle(article, siteUrl, styles, settings = defaultSiteSettings) {
  return documentPage({
    title: article.title,
    description: article.description,
    url: new URL(articleUrl(article), siteUrl).href,
    styles,
    article,
    settings,
    body: `<main class="article-main">${renderBreadcrumbs(article.title)}
<article><div class="news-card__meta"><span>${escape(article.category)}</span><time datetime="${escape(article.date)}">${formatArticleDate(article.date)}</time></div>
<h1>${escape(article.title)}</h1><p class="article-lead">${escape(article.description)}</p>
${article.image ? `<img class="article-cover" src="${escape(article.image)}" alt="" width="1200" height="675">` : ""}
<div class="article-copy">${article.sections.map((section) => `<section>${section.heading ? `<h2>${escape(section.heading)}</h2>` : ""}${section.paragraphs.map((text) => `<p>${escape(text)}</p>`).join("")}</section>`).join("")}</div>
</article><div class="article-cta"><p>Готовы выйти на сцену?</p><a class="button button--lime" href="/#application">Подать заявку ${arrowIcon}</a></div></main>`,
  });
}

export function renderNewsIndex(articles, siteUrl, styles, settings = defaultSiteSettings) {
  return documentPage({
    title: settings.news.title,
    description:
      "Новости конкурса «Танцевальная революция», анонсы и полезные статьи для хореографических коллективов.",
    url: new URL("/news", siteUrl).href,
    styles,
    noindex: articles.length === 0,
    settings,
    body: `<main class="news-index">${renderBreadcrumbs()}<p class="section-label">Жизнь конкурса</p><h1>${escape(settings.news.title)}</h1><p class="news-index__lead">${escape(settings.news.lead)}</p>
${
  articles.length
    ? `<div class="news-grid">${articles
        .map(
          (
            article,
          ) => `<article class="news-card"><a class="news-card__link" href="${articleUrl(article)}">
${article.image ? `<img src="${escape(article.image)}" alt="" loading="lazy" width="1200" height="675">` : ""}
<div class="news-card__body"><div class="news-card__meta"><span>${escape(article.category)}</span><time datetime="${escape(article.date)}">${formatArticleDate(article.date)}</time></div>
<h2>${escape(article.title)}</h2><p>${escape(article.description)}</p><span class="text-link">Читать материал ${arrowIcon}</span></div></a></article>`,
        )
        .join("")}</div>`
    : `<div class="news-empty"><span class="news-empty__label">Скоро в ленте</span><h2>${escape(settings.news.emptyTitle)}</h2><p>${escape(settings.news.emptyText)}</p><a class="text-link" href="${escape(settings.contacts.telegramUrl)}" target="_blank" rel="noreferrer">Следить в Telegram ${arrowIcon}</a></div>`
}</main>`,
  });
}

export function renderSitemap(articles, siteUrl) {
  const pages = [
    "/",
    "/privacy",
    "/consent",
    ...(articles.length ? ["/news"] : []),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map((url) => `<url><loc>${escape(new URL(url, siteUrl).href)}</loc></url>`).join("")}${articles.map((article) => `<url><loc>${escape(new URL(articleUrl(article), siteUrl).href)}</loc></url>`).join("")}</urlset>\n`;
}

export function renderNotFound(siteUrl, styles, settings = defaultSiteSettings) {
  return documentPage({
    title: "Материал не найден",
    description: "Этот материал не опубликован.",
    url: new URL("/news", siteUrl).href,
    styles,
    noindex: true,
    settings,
    body: `<main class="article-main">${renderBreadcrumbs("Материал не найден")}<h1>Материал не найден</h1><a class="text-link" href="/news">Все новости и статьи ${arrowIcon}</a></main>`,
  });
}
