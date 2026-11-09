import { useSiteSettings } from "../SiteSettings.jsx";
import { homeText } from "../../shared/site-settings.js";

export default function Format() {
  const settings = useSiteSettings();
  const { format, registration } = settings.home;
  return <section className="stage section section--dark" id="format">
    <div className="shell section-heading section-heading--right">
      <p className="section-label reveal">02 / Формат</p>
      <h2 className="display-title reveal">{format.title} <em>{format.accent}</em></h2>
    </div>
    <div className="shell stage__visual reveal parallax-media">
      <img src={format.image} alt="Хореографический коллектив на сцене" width="1600" height="900" />
      <div className="stage__caption"><span>{format.caption}</span><strong>до {Math.floor(registration.maxDurationSeconds / 60)}:{String(registration.maxDurationSeconds % 60).padStart(2, "0")} на номер</strong></div>
    </div>
    <div className="shell format-grid reveal">
      {format.items.map((item, index) => <article key={index}>
        <span>{String(index + 1).padStart(2, "0")}</span>
        <h3>{homeText(item.title, settings)}</h3><p>{homeText(item.text, settings)}</p>
      </article>)}
    </div>
  </section>;
}
