import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { validateArticles, formatArticleDate } from "../../shared/news.js";
import { validateSiteSettings } from "../../shared/site-settings.js";
import SettingsEditor from "./SettingsEditor.jsx";
import ApplicationsPage from "./ApplicationsPage.jsx";
import "./styles.css";

async function request(url, { method = "GET", data, csrf, file } = {}) {
  const headers = { "X-Admin-Request": "1" };
  if (csrf) headers["X-CSRF-Token"] = csrf;
  if (file) headers["Content-Type"] = file.type || "application/octet-stream";
  else if (data) headers["Content-Type"] = "application/json";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, {
      method,
      credentials: "same-origin",
      headers,
      body: file || (data ? JSON.stringify(data) : undefined),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(
        result?.message || "Не удалось выполнить запрос. Проверьте соединение.",
      );
      error.status = response.status;
      throw error;
    }
    if (!result || typeof result !== "object" || Array.isArray(result))
      throw new Error("Сервер вернул некорректный ответ. Введённые данные остались в форме; проверьте состояние записи перед повторной отправкой.");
    return result;
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error("Сервер не ответил вовремя. Проверьте, сохранились ли изменения, прежде чем повторять запрос.");
    if (error instanceof TypeError)
      throw new Error("Нет связи с сервером. Проверьте подключение к интернету.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function Brand() {
  return (
    <a className="cms-brand" href="/" target="_blank" rel="noreferrer">
      <span>ТАНЦЕВАЛЬНАЯ</span>
      <strong>революция</strong>
    </a>
  );
}
function Login({ onLogin, expired }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onLogin(
        await request("/api/admin/login", {
          method: "POST",
          data: { login, password },
        }),
      );
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="cms-login">
      <div className="cms-login__brand">
        <Brand />
        <p>
          Место, где начинаются
          <br />
          новые истории.
        </p>
      </div>
      <form className="cms-login__form" onSubmit={submit}>
        <p className="cms-eyebrow">Управление сайтом</p>
        <h1>Войти в админку</h1>
        <p className="cms-muted">
          {expired
            ? "Сессия закончилась. Войдите снова — введённый текст сохранён в этой вкладке."
            : "Новости, даты, цены и информация о конкурсе — в одном месте."}
        </p>
        <label>
          Логин
          <input
            name="login"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            minLength={3}
            maxLength={64}
            value={login}
            onChange={(event) => setLogin(event.target.value)}
          />
        </label>
        <label>
          Пароль
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={256}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && (
          <p className="cms-error" role="alert">
            {error}
          </p>
        )}
        <button className="cms-button cms-button--primary" disabled={busy}>
          {busy ? "Входим…" : "Войти"}
        </button>
        <a className="cms-muted" href="/">
          Вернуться на сайт
        </a>
      </form>
    </main>
  );
}

const newDraft = () => ({
  title: "",
  slug: "",
  description: "",
  category: "Новости",
  date: new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow" }).format(
    new Date(),
  ),
  image: "",
  published: false,
  sections: [{ heading: "", text: "" }],
});
const fromArticle = (article) => ({
  ...article,
  sections: article.sections.map((section) => ({
    heading: section.heading || "",
    text: section.paragraphs.join("\n\n"),
  })),
});
const toArticle = (draft) => ({
  ...draft,
  sections: draft.sections.map((section) => ({
    heading: section.heading.trim(),
    paragraphs: section.text
      .split(/\n\s*\n/)
      .map((text) => text.trim())
      .filter(Boolean),
  })),
});
const transliterate = (title) => {
  const alphabet = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "yo",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };
  return [...title.toLowerCase()]
    .map((letter) => alphabet[letter] ?? letter)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100)
    .replace(/-$/, "");
};

function Admin() {
  const routeView = () => location.pathname.startsWith("/admin/applications") ? "applications" : location.pathname.startsWith("/admin/settings") ? "settings" : "news";
  const [view, setView] = useState(routeView);
  const [applicationRecord, setApplicationRecord] = useState(null);
  const [applicationDirty, setApplicationDirty] = useState(false);
  const [siteDraft, setSiteDraft] = useState(null);
  const [siteDirty, setSiteDirty] = useState(false);
  const [session, setSession] = useState(undefined);
  const [articles, setArticles] = useState([]);
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [preview, setPreview] = useState("");
  const formRef = useRef(null);
  const previewRef = useRef(null);
  const previewButtonRef = useRef(null);

  useEffect(() => {
    request("/api/admin/session")
      .then(setSession)
      .catch((error) => {
        setSession(null);
        if (error.status !== 401) setError(error.message);
      });
  }, []);
  useEffect(() => {
    if (!session) return;
    request("/api/admin/articles")
      .then((data) => setArticles(data.articles))
      .catch(fail);
    if (view === "settings" && !siteDraft) loadSettings();
  }, [session]);
  useEffect(() => {
    if (!dirty && !siteDirty && !applicationDirty) return;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, siteDirty, applicationDirty]);
  useEffect(() => {
    const navigate = () => {
      switchView(routeView(), false);
    };
    window.addEventListener("popstate", navigate);
    return () => window.removeEventListener("popstate", navigate);
  }, [view, dirty, siteDirty, applicationDirty]);
  useEffect(() => {
    if (preview) previewRef.current?.showModal();
  }, [preview]);

  function fail(error) {
    setError(error.message);
    if (error.status === 401) setSession(null);
  }
  function canLeave() {
    return (
      (!dirty && !siteDirty && !applicationDirty) ||
      window.confirm("Есть несохранённые изменения. Уйти без сохранения?")
    );
  }
  async function loadSettings() {
    setBusy(true);
    setError("");
    try {
      setSiteDraft(await request("/api/admin/settings"));
      setSiteDirty(false);
    } catch (error) { fail(error); }
    finally { setBusy(false); }
  }
  async function switchView(next, push = true) {
    if (next === view) return;
    if (!canLeave()) {
      if (!push) history.pushState(null, "", `/admin/${view === "news" ? "" : view}`);
      return;
    }
    setDraft(null);
    setDirty(false);
    setSiteDraft(null);
    setSiteDirty(false);
    setApplicationRecord(null);
    setApplicationDirty(false);
    setError("");
    setNotice("");
    setView(next);
    if (push) history.pushState(null, "", `/admin/${next === "news" ? "" : next}`);
    if (next === "settings") await loadSettings();
  }
  async function saveSettings() {
    setError("");
    setNotice("");
    let settings;
    try { settings = validateSiteSettings(siteDraft.settings); }
    catch (error) { fail(error); return; }
    setBusy(true);
    try {
      setSiteDraft(await request("/api/admin/settings", {method:"PUT", csrf:session.csrf, data:{settings, version:siteDraft.version}}));
      setSiteDirty(false);
      setNotice("Настройки сохранены. Обновите страницу сайта, чтобы увидеть изменения.");
    } catch (error) { fail(error); }
    finally { setBusy(false); }
  }
  async function uploadSetting(file, type, onUploaded) {
    const limit = type === "document" ? 10 : 2;
    if (file.size > limit * 1024 * 1024) { setError(`Выберите файл до ${limit} МБ.`); return; }
    setBusy(true);
    setError("");
    try {
      const result = await request(type === "document" ? "/api/admin/documents" : "/api/admin/media", {method:"POST", file, csrf:session.csrf});
      onUploaded(result.url);
    } catch (error) { fail(error); }
    finally { setBusy(false); }
  }
  function update(values) {
    setDraft((current) => ({ ...current, ...values }));
    setDirty(true);
    setNotice("");
  }
  function updateSection(index, values) {
    update({
      sections: draft.sections.map((section, i) =>
        i === index ? { ...section, ...values } : section,
      ),
    });
  }
  function back() {
    if (canLeave()) {
      setDraft(null);
      setDirty(false);
      setError("");
      setNotice("");
    }
  }
  async function open(id) {
    if (!canLeave()) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setDraft(
        fromArticle((await request(`/api/admin/articles/${id}`)).article),
      );
      setDirty(false);
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    setArticles((await request("/api/admin/articles")).articles);
  }
  async function save(published) {
    if (!formRef.current.reportValidity()) return;
    setError("");
    setNotice("");
    const data = { ...toArticle(draft), published };
    try {
      validateArticles([data]);
    } catch (error) {
      fail(error);
      return;
    }
    setBusy(true);
    try {
      const result = await request(
        draft.id ? `/api/admin/articles/${draft.id}` : "/api/admin/articles",
        { method: draft.id ? "PUT" : "POST", data, csrf: session.csrf },
      );
      setDraft(fromArticle(result.article));
      setDirty(false);
      setNotice(
        published
          ? "Публикация уже доступна на сайте."
          : "Черновик сохранён. Посетители его не видят.",
      );
      await refresh();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  async function remove(article) {
    if (
      !window.confirm(
        `Удалить «${article.title}»? Это действие нельзя отменить.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await request(`/api/admin/articles/${article.id}`, {
        method: "DELETE",
        csrf: session.csrf,
        data: { version: article.version },
      });
      if (draft?.id === article.id) {
        setDraft(null);
        setDirty(false);
      }
      setNotice("Запись удалена.");
      await refresh();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  async function upload(event) {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Выберите изображение до 2 МБ.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      update({
        image: (
          await request("/api/admin/media", {
            method: "POST",
            file,
            csrf: session.csrf,
          })
        ).url,
      });
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  async function showPreview() {
    if (!formRef.current.reportValidity()) return;
    setBusy(true);
    setError("");
    try {
      setPreview(
        (
          await request("/api/admin/preview", {
            method: "POST",
            data: toArticle(draft),
            csrf: session.csrf,
          })
        ).html,
      );
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (!canLeave()) return;
    setBusy(true);
    try {
      await request("/api/admin/logout", {
        method: "POST",
        csrf: session.csrf,
      });
      setSession(null);
      setDraft(null);
      setSiteDraft(null);
      setSiteDirty(false);
      setDirty(false);
      setApplicationRecord(null);
      setApplicationDirty(false);
      setError("");
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  if (session === undefined)
    return (
      <p className="cms-loading" role="status">
        Открываем редактор…
      </p>
    );
  if (!session)
    return (
      <>
        <Login
          expired={Boolean(draft || siteDraft || applicationRecord)}
          onLogin={(value) => {
            setError("");
            setSession(value);
          }}
        />
        {error && (
          <p className="cms-connection-error" role="alert">
            {error}
          </p>
        )}
      </>
    );
  const shown = articles.filter(
    (article) =>
      (filter === "all" || article.published === (filter === "published")) &&
      article.title.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="cms-app">
      <header className="cms-header">
        <Brand />
        <div>
          <span>{session.user.login}</span>
          <button
            className="cms-button cms-button--dark"
            onClick={logout}
            disabled={busy}
          >
            Выйти
          </button>
        </div>
      </header>
      <main className="cms-main">
        <nav className="cms-section-tabs" aria-label="Разделы админки">
          <button className="cms-button" aria-pressed={view === "applications"} disabled={busy} onClick={() => switchView("applications")}>Заявки</button>
          <button className="cms-button" aria-pressed={view === "news"} disabled={busy} onClick={() => switchView("news")}>Новости и статьи</button>
          <button className="cms-button" aria-pressed={view === "settings"} disabled={busy} onClick={() => switchView("settings")}>Настройки сайта</button>
        </nav>
        <div className="cms-page-heading">
          <div>
            <p className="cms-eyebrow">Управление конкурсом</p>
            <h1>
              {view === "applications" ? "Заявки участников" : view === "settings" ? "Настройки сайта" : draft
                ? draft.id
                  ? "Редактировать запись"
                  : "Новая публикация"
                : "Новости и статьи"}
            </h1>
          </div>
          {view !== "news" ? <a className="cms-button" href="/" target="_blank" rel="noreferrer">Открыть сайт</a> : draft ? (
            <button className="cms-button" onClick={back} disabled={busy}>
              К списку публикаций
            </button>
          ) : (
            <button
              className="cms-button cms-button--primary"
              onClick={() => {
                setDraft(newDraft());
                setDirty(false);
                setNotice("");
                setError("");
              }}
              disabled={busy}
            >
              Новая публикация
            </button>
          )}
        </div>
        {error && (
          <p className="cms-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="cms-success" role="status">
            {notice}
          </p>
        )}
        {view === "applications" ? <ApplicationsPage request={request} csrf={session.csrf} fail={fail} record={applicationRecord} setRecord={setApplicationRecord} dirty={applicationDirty} setDirty={setApplicationDirty} /> : view === "settings" ? <SettingsEditor record={siteDraft} dirty={siteDirty} busy={busy}
          onChange={settings => { setSiteDraft(current => ({...current,settings})); setSiteDirty(true); setNotice(""); }}
          onSave={saveSettings} onReload={() => { if (canLeave()) { setNotice(""); loadSettings(); } }} onUpload={uploadSetting} /> : !draft ? (
          <>
            <div className="cms-toolbar">
              <div className="cms-tabs" aria-label="Фильтр публикаций">
                {[
                  ["all", "Все"],
                  ["published", "На сайте"],
                  ["draft", "Черновики"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                aria-label="Найти публикацию"
                type="search"
                placeholder="Найти публикацию…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="cms-posts">
              {shown.length ? (
                shown.map((article) => (
                  <article className="cms-post" key={article.id}>
                    <div>
                      <span
                        className={`cms-badge${article.published ? " is-published" : ""}`}
                      >
                        {article.published ? "На сайте" : "Черновик"}
                      </span>
                      <h2>
                        <button
                          onClick={() => open(article.id)}
                          disabled={busy}
                        >
                          {article.title}
                        </button>
                      </h2>
                      <p>
                        {article.category} · {formatArticleDate(article.date)}
                      </p>
                    </div>
                    <div className="cms-post__actions">
                      <button
                        className="cms-button"
                        onClick={() => open(article.id)}
                        disabled={busy}
                      >
                        Редактировать
                      </button>
                      <button
                        className="cms-text-button cms-danger"
                        onClick={() => remove(article)}
                        disabled={busy}
                      >
                        Удалить
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="cms-empty">
                  <h2>
                    {search
                      ? "Ничего не найдено"
                      : "Здесь будут ваши публикации"}
                  </h2>
                  <p>
                    Создайте новость или статью и сохраните её как черновик.
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <form
            ref={formRef}
            className="cms-editor"
            onSubmit={(event) => {
              event.preventDefault();
              save(draft.published);
            }}
          >
            <fieldset className="cms-editor__content" disabled={busy}>
              <div className="cms-panel">
                <label>
                  Заголовок
                  <input
                    className="cms-title-input"
                    name="title"
                    required
                    maxLength={200}
                    value={draft.title}
                    placeholder="О чём расскажем?"
                    onChange={(event) =>
                      update({
                        title: event.target.value,
                        ...(!draft.id &&
                        (!draft.slug ||
                          draft.slug === transliterate(draft.title))
                          ? { slug: transliterate(event.target.value) }
                          : {}),
                      })
                    }
                  />
                </label>
                <label>
                  Краткое описание
                  <textarea
                    name="description"
                    required
                    maxLength={600}
                    rows={3}
                    value={draft.description}
                    onChange={(event) =>
                      update({ description: event.target.value })
                    }
                  />
                  <small>
                    Одно-два предложения для карточки и поисковой выдачи.
                  </small>
                </label>
              </div>
              <div className="cms-panel">
                <div className="cms-panel__heading">
                  <h2>Текст статьи</h2>
                  <span>{draft.sections.length} / 30 разделов</span>
                </div>
                {draft.sections.map((section, index) => (
                  <section className="cms-section" key={index}>
                    <div className="cms-section__heading">
                      <strong>Раздел {index + 1}</strong>
                      {draft.sections.length > 1 && (
                        <button
                          type="button"
                          className="cms-text-button cms-danger"
                          onClick={() => {
                            if (
                              !section.text ||
                              window.confirm(
                                "Удалить этот раздел вместе с текстом?",
                              )
                            )
                              update({
                                sections: draft.sections.filter(
                                  (_, i) => i !== index,
                                ),
                              });
                          }}
                        >
                          Удалить раздел
                        </button>
                      )}
                    </div>
                    <label>
                      Подзаголовок{" "}
                      <span className="cms-muted">необязательно</span>
                      <input
                        maxLength={200}
                        value={section.heading}
                        onChange={(event) =>
                          updateSection(index, { heading: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Текст
                      <textarea
                        name={`section-${index}`}
                        required
                        rows={9}
                        value={section.text}
                        onChange={(event) =>
                          updateSection(index, { text: event.target.value })
                        }
                        placeholder="Напишите историю…"
                      />
                      <small>Разделяйте абзацы пустой строкой.</small>
                    </label>
                  </section>
                ))}
                <button
                  type="button"
                  className="cms-button"
                  disabled={draft.sections.length >= 30}
                  onClick={() =>
                    update({
                      sections: [...draft.sections, { heading: "", text: "" }],
                    })
                  }
                >
                  Добавить раздел
                </button>
              </div>
            </fieldset>
            <aside className="cms-editor__settings">
              <fieldset className="cms-panel" disabled={busy}>
                <h2>Публикация</h2>
                <span
                  className={`cms-badge${draft.published ? " is-published" : ""}`}
                >
                  {draft.published ? "Доступна на сайте" : "Черновик"}
                </span>
                <label>
                  Адрес статьи
                  <input
                    name="slug"
                    required
                    readOnly={Boolean(draft.id)}
                    maxLength={100}
                    pattern="(?!index$)[a-z0-9]+(-[a-z0-9]+)*"
                    value={draft.slug}
                    onChange={(event) => update({ slug: event.target.value })}
                  />
                  <small>
                    {draft.id
                      ? "Адрес закреплён, чтобы сохранялись ссылки."
                      : "Латиница, цифры и дефисы. Заполняется из заголовка."}
                  </small>
                </label>
                <label>
                  Дата
                  <input
                    name="date"
                    type="date"
                    required
                    value={draft.date}
                    onChange={(event) => update({ date: event.target.value })}
                  />
                  <small>
                    Дата в подписи статьи; публикация происходит сразу.
                  </small>
                </label>
                <label>
                  Рубрика
                  <input
                    name="category"
                    required
                    maxLength={60}
                    value={draft.category}
                    onChange={(event) =>
                      update({ category: event.target.value })
                    }
                  />
                </label>
              </fieldset>
              <fieldset className="cms-panel" disabled={busy}>
                <h2>Обложка</h2>
                {draft.image && (
                  <>
                    <img
                      className="cms-cover"
                      src={draft.image}
                      alt="Обложка публикации"
                    />
                    <button
                      className="cms-text-button cms-danger"
                      type="button"
                      onClick={() => update({ image: "" })}
                    >
                      Убрать обложку
                    </button>
                  </>
                )}
                <label className="cms-upload">
                  {draft.image
                    ? "Заменить изображение"
                    : "Загрузить изображение"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="Загрузить обложку"
                    onChange={upload}
                  />
                  <small>JPG, PNG или WebP · до 2 МБ</small>
                </label>
              </fieldset>
              <div className="cms-panel cms-save">
                <p className="cms-muted" role="status">
                  {busy
                    ? "Сохраняем…"
                    : dirty
                      ? "Есть несохранённые изменения"
                      : draft.id
                        ? "Все изменения сохранены"
                        : "Запись ещё не сохранена"}
                </p>
                <button
                  className="cms-button cms-button--primary"
                  type="button"
                  disabled={busy}
                  onClick={() => save(true)}
                >
                  {draft.published ? "Сохранить изменения" : "Опубликовать"}
                </button>
                <button
                  className="cms-button"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      !draft.published ||
                      window.confirm(
                        "Снять запись с публикации? Она сохранится в черновиках.",
                      )
                    )
                      save(false);
                  }}
                >
                  {draft.published
                    ? "Снять с публикации"
                    : "Сохранить черновик"}
                </button>
                <button
                  ref={previewButtonRef}
                  className="cms-text-button"
                  type="button"
                  disabled={busy}
                  onClick={showPreview}
                >
                  Предпросмотр
                </button>
                {draft.published && (
                  <a
                    className="cms-text-button"
                    target="_blank"
                    rel="noreferrer"
                    href={`/news/${draft.slug}`}
                  >
                    Открыть на сайте
                  </a>
                )}
              </div>
            </aside>
          </form>
        )}
      </main>
      <dialog
        ref={previewRef}
        className="cms-preview"
        onClose={() => {
          setPreview("");
          previewButtonRef.current?.focus();
        }}
      >
        <div>
          <strong>Предпросмотр публикации</strong>
          <button
            className="cms-button"
            onClick={() => previewRef.current.close()}
          >
            Закрыть
          </button>
        </div>
        {preview && (
          <iframe title="Предпросмотр статьи" sandbox="allow-same-origin" srcDoc={preview} />
        )}
      </dialog>
    </div>
  );
}

createRoot(document.getElementById("admin-root")).render(<Admin />);
