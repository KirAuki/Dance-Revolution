import { defaultSiteSettings, phoneHref } from "./site-settings.js";
import { pageDefinitions } from "./site-pages.js";
import { documentPage, escapeHtml, backArrowIcon } from "./page-html.js";

export function renderLegalPage(key, siteUrl, styles, settings = defaultSiteSettings) {
  const definition = pageDefinitions.find(page => page.key === key);
  if (!definition) throw new Error("Unknown document page");
  const page = (settings.pages ?? defaultSiteSettings.pages)[key];
  const replacements = {
    email: { text: settings.contacts.email, href: `mailto:${settings.contacts.email}` },
    phone: { text: settings.contacts.phone, href: phoneHref(settings.contacts.phone) },
    privacy: { text: "Политикой конфиденциальности", href: "/privacy" },
    regulations: { text: "Положением конкурса", href: settings.documents.regulations },
  };
  // Editor content is plain text; only these four controlled links can produce HTML.
  const inline = text => escapeHtml(text).replace(/\{(email|phone|privacy|regulations)\}/g, (_, key) => {
    const link = replacements[key];
    return `<a href="${escapeHtml(link.href)}">${escapeHtml(link.text)}</a>`;
  });
  return documentPage({
    title: page.title, description: page.lead,
    url: new URL(`/${key}`, siteUrl).href, styles, settings, bodyClass: "legal-page",
    body: `<main class="legal-main">
<nav class="page-breadcrumbs" aria-label="Хлебные крошки"><ol><li><a href="/">${backArrowIcon}Главная</a></li><li><span class="page-breadcrumbs__separator" aria-hidden="true">/</span><span aria-current="page">${escapeHtml(definition.label)}</span></li></ol></nav>
<p class="section-label">Документы / ${escapeHtml(settings.event.startDate.slice(0, 4))}</p>
<h1>${escapeHtml(page.title)}</h1><p class="legal-lead">${inline(page.lead)}</p>
${page.sections.map((section, index) => `<section><h2>${index + 1}. ${escapeHtml(section.heading)}</h2><div>${section.text.split(/\r?\n\s*\r?\n/).filter(text => text.trim()).map(text => `<p>${inline(text)}</p>`).join("")}</div></section>`).join("")}
<nav class="legal-related" aria-label="Другие документы">${pageDefinitions.filter(item => item.key !== key).map(item => `<a href="/${item.key}">${escapeHtml(item.label)}</a>`).join("")}</nav>
</main>`,
  });
}
