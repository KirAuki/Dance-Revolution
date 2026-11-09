import { useSiteSettings } from "../SiteSettings.jsx";
import { money } from "../../shared/site-settings.js";

export default function Premium() {
  const { prices, home: { premium } } = useSiteSettings();
  return <section className="premium section section--light" id="premium">
    <div className="shell premium__layout">
      <div className="premium__sticky">
        <p className="section-label reveal">07 / Премия</p>
        <h2 className="display-title display-title--marker reveal">{money(prices.premium)} <em className="title-marker">{premium.accent}</em></h2>
        <p className="section-intro reveal">{premium.intro}</p>
      </div>
      <ol className="premium-list">
        {premium.items.map((item, index) => <li className="reveal" key={index}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.title}</strong></li>)}
      </ol>
    </div>
  </section>;
}
