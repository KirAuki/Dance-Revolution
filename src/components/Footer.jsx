import ArrowIcon from "./ArrowIcon.jsx";
import { useSiteSettings } from "../SiteSettings.jsx";
import { phoneHref } from "../../shared/site-settings.js";

export default function Footer() {
  const { event, contacts, documents } = useSiteSettings();
  return (
    <footer className="footer" id="contacts">
      <div className="shell footer__hero">
        <a className="footer__logo" href="#top">
          <span>ТАНЦЕВАЛЬНАЯ</span>
          <strong>революция</strong>
        </a>
        <a className="footer__mail" href={`mailto:${contacts.email}`}>
          {contacts.email} <ArrowIcon />
        </a>
      </div>
      <div className="shell footer__grid">
        <div>
          <span>Оргкомитет</span>
          <a href={phoneHref(contacts.phone)}>{contacts.phone}</a>
          <small>{contacts.hours}</small>
        </div>
        <div>
          <span>Мессенджеры</span>
          <a href={contacts.telegramUrl} target="_blank" rel="noreferrer">
            {contacts.telegramLabel}
          </a>
          <a
            href={contacts.maxUrl}
            target="_blank"
            rel="noreferrer"
          >
            {contacts.maxLabel}
          </a>
        </div>
        <div>
          <span>Фонограммы</span>
          <a href={`mailto:${contacts.tracksEmail}`}>{contacts.tracksEmail}</a>
          <small>WAV или MP3 после подтверждения</small>
        </div>
        <div>
          <span>Документы</span>
          <a
            href={documents.regulations}
            download
          >
            Положение
          </a>
          <a href="/privacy.html">Политика конфиденциальности</a>
          <a href="/consent.html">Согласие на обработку ПД</a>
          <a href="/news">Новости и статьи</a>
        </div>
      </div>
      <div className="shell footer__bottom">
        <span>© {event.startDate.slice(0, 4)} «Танцевальная революция»</span>
        <span>Организатор: ИП Шубенко Дмитрий Геннадьевич</span>
        <span>{event.city}</span>
      </div>
    </footer>
  );
}
