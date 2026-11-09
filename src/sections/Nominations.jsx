import Accordion from "../components/Accordion.jsx";
import { useSiteSettings } from "../SiteSettings.jsx";

export default function Nominations() {
  const { home: { nominations } } = useSiteSettings();
  return <section className="nominations section section--lime" id="nominations">
    <div className="shell nominations__layout">
      <div className="nominations__intro">
        <p className="section-label reveal">04 / Номинации</p>
        <h2 className="display-title reveal">{nominations.title} <em className="title-black">{nominations.accent}</em></h2>
        <p className="section-intro reveal">{nominations.intro}</p>
      </div>
      <Accordion className="nomination-list reveal" items={nominations.items} numbered defaultOpen={0} />
    </div>
  </section>;
}
