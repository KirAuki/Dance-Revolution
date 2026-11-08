import { useSiteSettings } from "../SiteSettings.jsx";
import { phoneHref } from "../../shared/site-settings.js";

const socialLinks = [
  { key: "telegramUrl", label: "Telegram", icon: "telegram" },
  { key: "instagramUrl", label: "Instagram", icon: "instagram" },
  { key: "vkUrl", label: "VK", icon: "vk" },
  { key: "maxUrl", label: "MAX", icon: "max" },
  { key: "whatsappUrl", label: "WhatsApp", icon: "whatsapp" },
];

export default function Footer() {
  const { event, contacts, documents } = useSiteSettings();
  return (
    <footer className="footer" id="contacts">
      <div className="shell footer__hero">
        <a className="footer__logo" href="#top">
          <span>ТАНЦЕВАЛЬНАЯ</span>
          <strong>революция</strong>
        </a>
      </div>
      <div className="shell footer__grid">
        <div>
          <span>Оргкомитет</span>
          <a href={`mailto:${contacts.email}`}>{contacts.email}</a>
          <a href={phoneHref(contacts.phone)}>{contacts.phone}</a>
          <small>{contacts.hours}</small>
        </div>
        <div className="footer__social-column">
          <span>Соцсети и мессенджеры</span>
          <nav className="footer__socials" aria-label="Соцсети и мессенджеры">
            {socialLinks.filter(link => contacts[link.key]).map(link => (
              <a key={link.key} href={contacts[link.key]} aria-label={link.label} title={link.label} target="_blank" rel="noopener noreferrer">
                <img src={`/assets/social/${link.icon}.svg`} width="24" height="24" alt="" loading="lazy" />
              </a>
            ))}
          </nav>
        </div>
        <div>
          <span>Документы</span>
          <a
            href={documents.regulations}
            download
          >
            Положение
          </a>
          <a href="/privacy">Политика конфиденциальности</a>
          <a href="/consent">Согласие на обработку ПД</a>
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
