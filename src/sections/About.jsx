import Counter from "../components/Counter.jsx";
import { useSiteSettings } from "../SiteSettings.jsx";
import { daysBetween, countLabel } from "../../shared/site-settings.js";

export default function About() {
  const { event, home } = useSiteSettings();
  const days = daysBetween(event.startDate, event.endDate) + 1;
  return (
    <section className="about section section--light" id="about">
      <div className="shell about__grid">
        <p className="section-label reveal">01 / О проекте</p>
        <div>
          <h2 className="display-title display-title--marker reveal">
            {home.about.title}{" "}
            <em className="title-marker">{home.about.accent}</em>
          </h2>
          <div className="about__copy reveal">
            {home.about.text.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          </div>
        </div>
      </div>
      <div className="shell facts-grid reveal">
        <article className="fact">
          <Counter value={days} suffix="" />
          <span>{countLabel(days, ["конкурсный день", "конкурсных дня", "конкурсных дней"]).replace(/^\d+ /, "")}</span>
        </article>
        <article className="fact">
          <Counter value={home.nominations.items.length} suffix="+" />
          <span>направлений</span>
        </article>
        <article className="fact">
          <Counter value={home.categories.ages.length} suffix="" />
          <span>возрастных категорий</span>
        </article>
        <article className="fact fact--dark">
          <strong>{home.registration.minParticipants}+</strong>
          <span>участников в коллективе</span>
        </article>
      </div>
    </section>
  );
}
