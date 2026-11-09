import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { publishedArticles, validateArticles } from "../shared/news.js";

const draft=JSON.parse(readFileSync("content/news/kak-podgotovit-zayavku.json","utf8"));
test("drafts are excluded and the editor rejects invalid article addresses and images",()=>{
  assert.deepEqual(publishedArticles(validateArticles([draft])),[]);
  for(const values of [{slug:"../escape"},{slug:"index"},{slug:undefined},{date:"2026-02-30"},{image:"javascript:alert(1)"}])
    assert.throws(()=>validateArticles([{...draft,...values}]));
  assert.throws(()=>validateArticles([draft,draft]));
  assert.doesNotThrow(()=>validateArticles([{...draft,sections:[{paragraphs:["Текст без подзаголовка"]}]}]));
});
