import { useSiteSettings } from "../SiteSettings.jsx";
import { dayCount, eventDate } from "../../shared/site-settings.js";

export default function Schedule() {
  const { event, program } = useSiteSettings();
  const dates = [event.arrivalDate, event.startDate, event.endDate, event.departureDate];
  return (
    <section className="timeline section section--lime" id="schedule">
      <div className="shell section-heading">
        <p className="section-label reveal">10 / Программа для иногородних</p>
        <h2 className="display-title reveal">
          {dayCount(event.arrivalDate, event.departureDate, true)} <em className="title-black">в ритме танца.</em>
        </h2>
      </div>
      <div className="shell timeline__grid reveal">
        {program.map((item, index) => (
          <article key={index}>
            <time dateTime={dates[index]}>{eventDate(dates[index], {padded: true, year: true})}</time>
            <strong>{item.title}</strong>
            <div className="timeline__details">
              <ul className="timeline__events">
                {item.text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((line, lineIndex) => (
                  <li key={lineIndex}>{line}</li>
                ))}
              </ul>
              {item.note && <p className="timeline__note"><b>Важно</b>{item.note}</p>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
