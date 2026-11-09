import { useSiteSettings } from "../SiteSettings.jsx";

export default function Categories() {
  const { home: { categories } } = useSiteSettings();
  return <section className="categories section section--light" id="categories">
    <div className="shell section-heading">
      <p className="section-label reveal">05 / Категории и оценка</p>
      <h2 className="display-title display-title--marker reveal">{categories.title}<br /><em className="title-marker">{categories.accent}</em></h2>
    </div>
    <div className="shell age-strip reveal" aria-label="Возрастные категории">
      {categories.ages.map((item, index) => <span key={index}>{item.label}</span>)}
    </div>
    <div className="shell criteria-grid reveal">
      {categories.criteria.map((item, index) => <article className="criteria-card" key={index}>
        <span>{String(index + 1).padStart(2, "0")}</span><strong>{item.title}</strong><p>{item.text}</p>
      </article>)}
    </div>
    <p className="shell category-note reveal">{categories.note}</p>
  </section>;
}
