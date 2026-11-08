export const escapeHtml = value => String(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
export const arrowIcon = '<span class="arrow-icon" aria-hidden="true"></span>';
export const backArrowIcon = '<span class="arrow-icon arrow-icon--left" aria-hidden="true"></span>';

export function documentPage({ title, description, url, body, styles, noindex = false, article, settings, bodyClass = "news-page" }) {
  const schema = article ? JSON.stringify({
    "@context": "https://schema.org", "@type": "Article",
    headline: article.title, description: article.description, datePublished: article.date,
    mainEntityOfPage: url,
    ...(article.image ? { image: new URL(article.image, url).href } : {}),
    publisher: { "@type": "Organization", name: "Танцевальная революция" },
  }).replaceAll("<", "\\u003c") : "";
  return `<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#050505"><title>${escapeHtml(title)} — Танцевальная революция</title>
<meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${escapeHtml(url)}">
<meta name="robots" content="${noindex ? "noindex,follow" : "index,follow"}">
<meta property="og:type" content="${article ? "article" : "website"}"><meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(url)}">
${article?.image ? `<meta property="og:image" content="${escapeHtml(new URL(article.image, url).href)}">` : ""}
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">${styles}
${schema ? `<script type="application/ld+json">${schema}</script>` : ""}
</head><body class="${escapeHtml(bodyClass)}">
<header class="page-header"><a class="mini-logo" href="/" aria-label="На главную"><span>ТАНЦЕВАЛЬНАЯ</span><strong>революция</strong></a><a class="button button--lime" href="/#application">Подать заявку ${arrowIcon}</a></header>
${body}
<footer class="page-footer"><span>© ${escapeHtml(settings.event.startDate.slice(0, 4))} «Танцевальная революция»</span><a href="/">Вернуться на сайт ${arrowIcon}</a></footer>
</body></html>`;
}
