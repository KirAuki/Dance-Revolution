import { useSiteSettings } from "../SiteSettings.jsx";
import { eventDate } from "../../shared/site-settings.js";

export default function Conditions() {
  const { event } = useSiteSettings();
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
            <span>Подача заявок {event.localLabel}</span>
            <strong>до {eventDate(event.localDeadline, {year: true})}</strong>
          </article>
          <article className="reveal">
            <span>Подача заявок иногородние коллективы</span>
            <strong>до {eventDate(event.travelDeadline, {year: true})}</strong>
          </article>
        </div>
      </div>
    </section>
  );
}
