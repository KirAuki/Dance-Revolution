import ArrowIcon from "../components/ArrowIcon.jsx";
import { useSiteSettings } from "../SiteSettings.jsx";
import { compactEventDates } from "../../shared/site-settings.js";

export default function Venue() {
  const { event, venue } = useSiteSettings();
  const dates = compactEventDates(event.startDate, event.endDate);
  return (
    <section className="venue section section--light" id="venue">
      <div className="shell section-heading">
        <p className="section-label reveal">03 / Площадка</p>
        <h2 className="display-title display-title--marker reveal">
          Сцена, которую <em className="title-marker">видела вся страна.</em>
        </h2>
        <p className="section-intro reveal">
          {venue.name} — {venue.address}. {venue.description}
        </p>
      </div>
      <div className="shell photo-story photo-story--single">
        <figure className="photo-story__main reveal parallax-media">
          <img
            src={venue.image}
            alt={venue.name}
            width="1800"
            height="1200"
            loading="lazy"
          />
          <figcaption>
            <span>01</span> {venue.name}
          </figcaption>
        </figure>
        <div className={`photo-story__note reveal${event.startDate.slice(0, 7) !== event.endDate.slice(0, 7) ? " photo-story__note--long-date" : ""}`}>
          <strong>
            {dates[0]}
            <br />
            {dates[1]}
          </strong>
          <p>Один зал для всей конкурсной программы и общего финала.</p>
          <a
            className="text-link"
            href={venue.mapUrl}
            target="_blank"
            rel="noreferrer"
          >
            Открыть маршрут <ArrowIcon />
          </a>
        </div>
      </div>
    </section>
  );
}
