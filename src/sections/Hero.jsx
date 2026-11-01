import HeroVideo from "../components/HeroVideo.jsx";
import ArrowIcon from "../components/ArrowIcon.jsx";
import { useSiteSettings } from "../SiteSettings.jsx";
import { compactEventDates, eventRange } from "../../shared/site-settings.js";

export default function Hero() {
  const { event, venue, documents } = useSiteSettings();
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <HeroVideo />
      <div className="hero__shade"></div>
      <div className="hero__signal" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div className="shell hero__content">
        <p className="eyebrow reveal">
          Международная премия-конкурс в сфере хореографического искусства
        </p>
        <div className="hero__date reveal">
          <time dateTime={event.startDate}>{compactEventDates(event.startDate, event.endDate).join(" / ").replace("·", " / ")}</time>
          <span>{event.city}</span>
        </div>
        <h1 id="hero-title" className="hero__title reveal">
          <span>ТАНЦЕВАЛЬНАЯ</span>
          <strong>РЕВОЛЮЦИЯ</strong>
        </h1>
        <p className="hero__lead reveal">
          Конкурсная программа на большой сцене — для хореографических
          коллективов из России и стран ближнего зарубежья.
        </p>
        <div className="hero__actions reveal">
          <a className="button button--lime button--large" href="#application">
            Подать заявку <ArrowIcon />
          </a>
          <a
            className="button button--ghost button--large"
            href={documents.regulations}
            download
          >
            Скачать положение <ArrowIcon direction="down" />
          </a>
        </div>
      </div>
      <div className="shell hero__meta reveal">
        <div>
          <span>Даты</span>
          <strong>{eventRange(event.startDate, event.endDate)}</strong>
        </div>
        <div>
          <span>Город</span>
          <strong>{event.city}</strong>
        </div>
        <div>
          <span>Площадка</span>
          <a
            href={venue.mapUrl}
            target="_blank"
            rel="noreferrer"
          >
            {venue.name} <ArrowIcon />
          </a>
        </div>
      </div>
    </section>
  );
}
