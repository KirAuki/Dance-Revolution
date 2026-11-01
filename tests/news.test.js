import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { publishedArticles, validateArticles } from "../shared/news.js";
import {
  renderArticle,
  renderNewsIndex,
  renderSitemap,
} from "../shared/news-html.js";

const draft = JSON.parse(
  readFileSync(
    new URL("../content/news/kak-podgotovit-zayavku.json", import.meta.url),
    "utf8",
  ),
);
const article = { ...draft, published: true };
const origin = "https://example.com";

test("drafts stay out of public listings and sitemap", () => {
  const published = publishedArticles(validateArticles([draft]));
  assert.deepEqual(published, []);
  assert.ok(!renderNewsIndex(published, origin, "").includes(draft.title));
  assert.ok(!renderSitemap(published, origin).includes(draft.slug));
  assert.ok(
    renderNewsIndex(published, origin, "").includes('content="noindex,follow"'),
  );
});

test("published article HTML includes readable content and search metadata without JavaScript", () => {
  const html = renderArticle(
    article,
    origin,
    '<link rel="stylesheet" href="/styles.css">',
  );
  assert.ok(html.includes(`<h1>${article.title}</h1>`));
  assert.ok(html.includes(article.sections[0].paragraphs[0]));
  assert.ok(html.includes(`href="${origin}/news/${article.slug}"`));
  const schema = JSON.parse(
    html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1],
  );
  assert.equal(schema.headline, article.title);
  assert.equal(schema.datePublished, article.date);
  assert.ok(renderSitemap([article], origin).includes(`/news/${article.slug}`));
  assert.ok(
    !renderNewsIndex([article], origin, "").includes(
      'content="noindex,follow"',
    ),
  );
});

test("article validation rejects unsafe URLs and malformed dates; HTML escapes editor content", () => {
  assert.throws(() => validateArticles([{ ...article, slug: "../escape" }]));
  assert.throws(() => validateArticles([{ ...article, slug: "index" }]));
  assert.throws(() => validateArticles([{ ...article, slug: undefined }]));
  assert.throws(() => validateArticles([{ ...article, date: "2026-02-30" }]));
  assert.throws(() =>
    validateArticles([{ ...article, image: "javascript:alert(1)" }]),
  );
  assert.throws(() => validateArticles([article, article]));
  assert.doesNotThrow(() =>
    validateArticles([
      { ...article, sections: [{ paragraphs: ["Text without a subheading"] }] },
    ]),
  );
  const html = renderArticle(
    {
      ...article,
      title: '</script><img src=x onerror="alert(1)">',
      sections: [{ paragraphs: ["<script>alert(1)</script>"] }],
    },
    origin,
    "",
  );
  assert.ok(!html.includes("<img src=x"));
  assert.ok(!html.includes("<script>alert(1)"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
});
