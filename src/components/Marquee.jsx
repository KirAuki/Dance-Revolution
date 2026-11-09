import { Fragment } from "react";
import { useSiteSettings } from "../SiteSettings.jsx";

export default function Marquee() {
  const { home } = useSiteSettings();
  const phrases = Array.from({length: 8}, () => home.marquee.items.map(item => item.title)).flat();
  return (
    <div className="marquee marquee--lime" aria-hidden="true">
      <div className="marquee__track">
        {[0, 1].map((group) => (
          <div className="marquee__group" key={group}>
            {phrases.map((phrase, index) => (
              <Fragment key={index}>
                <span className="marquee__phrase">{phrase}</span>
                <span className="marquee__dot">·</span>
              </Fragment>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
