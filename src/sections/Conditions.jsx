import { useSiteSettings } from "../SiteSettings.jsx";
import { eventDate, money, countLabel } from "../../shared/site-settings.js";

export default function Conditions() {
  const { event, prices, contacts } = useSiteSettings();
  return (
    <section className="conditions section section--light" id="conditions">
      <div className="shell conditions__layout">
        <div className="conditions__sticky">
          <p className="section-label reveal">11 / Условия</p>
          <h2 className="display-title display-title--marker reveal">
            Важные <em className="title-marker">сроки.</em>
          </h2>
        </div>
        <div className="deadline-stack">
          <article className="reveal">
            <span>{event.localLabel}</span>
            <strong>до {eventDate(event.localDeadline, {year: true})}</strong>
          </article>
          <article className="reveal">
            <span>Иногородние коллективы</span>
            <strong>до {eventDate(event.travelDeadline, {year: true})}</strong>
          </article>
          <article className="reveal">
            <span>Фонограммы WAV или MP3</span>
            <strong>после подтверждения заявки</strong>
            <p>
              Отправляются на <a href={`mailto:${contacts.tracksEmail}`}>{contacts.tracksEmail}</a>. В названии файла укажите
              коллектив и конкурсный номер.
            </p>
          </article>
          <article className="reveal">
            <span>Замена репертуара</span>
            <strong>не позднее чем за {countLabel(prices.replacementDays, ["день", "дня", "дней"])}</strong>
            <p>
              При поздней замене взимается дополнительный организационный взнос
              {money(prices.lateChange)}.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
