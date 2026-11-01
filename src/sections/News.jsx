import { useEffect, useState } from "react";
import ArrowIcon from "../components/ArrowIcon.jsx";
import { articleUrl, formatArticleDate } from "../../shared/news.js";
import { useSiteSettings } from "../SiteSettings.jsx";

export default function News() {
  const { contacts } = useSiteSettings();
  const [latest, setLatest] = useState([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/news", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => setLatest(data.articles))
      .catch((error) => {
        if (error.name !== "AbortError") setFailed(true);
      });
    return () => controller.abort();
  }, []);
  return (
    <section className="news section section--dark" id="news">
      <div className="shell">
        <div className="news__heading">
          <div>
            <p className="section-label reveal">12 / Новости</p>
            <h2 className="display-title reveal">
              В ритме <em>событий.</em>
            </h2>
          </div>
          <p className="section-intro reveal">
            Новости конкурса, полезные статьи и всё, чем живёт «Танцевальная
            революция».
          </p>
        </div>
        {latest.length ? (
          <div className="news-grid">
            {latest.map((article) => (
              <article className="news-card" key={article.slug}>
                <a className="news-card__link" href={articleUrl(article)}>
                  {article.image && (
                    <img
                      src={article.image}
                      alt=""
                      loading="lazy"
                      width="1200"
                      height="675"
                    />
                  )}
                  <div className="news-card__body">
                    <div className="news-card__meta">
                      <span>{article.category}</span>
                      <time dateTime={article.date}>
                        {formatArticleDate(article.date)}
                      </time>
                    </div>
                    <h3>{article.title}</h3>
                    <p>{article.description}</p>
                    <span className="text-link">
                      Читать материал <ArrowIcon />
                    </span>
                  </div>
                </a>
              </article>
            ))}
          </div>
        ) : (
          <div className="news-empty">
            <span className="news-empty__label">
              {failed ? "Новости" : "Скоро в ленте"}
            </span>
            <h3>
              {failed
                ? "Не удалось загрузить новости."
                : "Истории, которые хочется читать."}
            </h3>
            <p>
              {failed
                ? "Попробуйте обновить страницу или следите за нами в Telegram."
                : "Здесь появятся анонсы, новости подготовки и материалы для участников. Пока следите за нами в Telegram."}
            </p>
            <a
              className="text-link"
              href={contacts.telegramUrl}
              target="_blank"
              rel="noreferrer"
            >
              Перейти в Telegram <ArrowIcon />
            </a>
          </div>
        )}
        <div className="news__actions">
          <a className="button button--outline" href="/news">
            Все новости и статьи <ArrowIcon />
          </a>
        </div>
      </div>
    </section>
  );
}
