import { useSiteSettings } from "../SiteSettings.jsx";

const cardStyles = ["award-card--grand", "award-card--money", "", "", "award-card--special"];
export default function Awards() {
  const { home: { awards } } = useSiteSettings();
  return <section className="awards section section--dark" id="awards">
    <div className="shell section-heading section-heading--right">
      <p className="section-label reveal">06 / Награды</p>
      <h2 className="display-title reveal">{awards.title} <em>{awards.accent}</em></h2>
    </div>
    <div className="shell award-grid reveal">
      {awards.items.map((item, index) => <article className={`award-card ${cardStyles[index]}`} key={index}>
        <span>{item.label}</span><strong>{item.title}</strong><p>{item.text}</p>
        {item.image && <img src={item.image} alt={item.title} width={index === 0 ? 900 : 1200} height={index === 0 ? 1200 : 700} loading="lazy" />}
        {index === 0 && <i aria-hidden="true">GRAND<br />PRIX</i>}
      </article>)}
    </div>
  </section>;
}
