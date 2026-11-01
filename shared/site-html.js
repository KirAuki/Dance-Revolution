import { eventRange, phoneHref } from "./site-settings.js";

const escape = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

export function renderSiteShell(html, settings) {
  const { event, venue, contacts } = settings;
  const dates = eventRange(event.startDate, event.endDate);
  const title = `Танцевальная революция — ${dates}, ${event.city}`;
  const description = `Международная премия-конкурс в сфере хореографического искусства «Танцевальная революция». ${event.city}, ${dates}. ${venue.name}.`;
  // A non-executable data block works with the production CSP and avoids stale dates on first paint.
  const data = JSON.stringify(settings).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
  return html.replace(/<title>[^<]*<\/title>/, () => `<title>${escape(title)}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, () => `<meta name="description" content="${escape(description)}">`)
    .replace(/<a data-contact-email[^>]*>.*?<\/a>/s, () => `<a data-contact-email href="mailto:${escape(contacts.email)}">${escape(contacts.email)}</a>`)
    .replace("</head>", () => `<script type="application/json" id="site-settings">${data}</script></head>`);
}

export function renderLegalPage(html, settings) {
  const { contacts, event, documents } = settings;
  return html
    .replace(/<a href="mailto:[^"]*">[^<]*<\/a>/g, () => `<a href="mailto:${escape(contacts.email)}">${escape(contacts.email)}</a>`)
    .replace(/<a href="tel:[^"]*">[^<]*<\/a>/g, () => `<a href="${escape(phoneHref(contacts.phone))}">${escape(contacts.phone)}</a>`)
    .replace(/Документы \/ \d{4}/g, () => `Документы / ${event.startDate.slice(0, 4)}`)
    .replace(/© \d{4}/g, () => `© ${event.startDate.slice(0, 4)}`)
    .replace(/href="\/docs\/[^\"]+\.docx"/g, () => `href="${escape(documents.regulations)}"`);
}
