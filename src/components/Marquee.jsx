import { Fragment } from "react";

const phrases = Array.from({ length: 8 }, () => [
  "ТВОЙ ТАНЕЦ",
  "ТВОЯ СЦЕНА",
  "ТВОЯ РЕВОЛЮЦИЯ",
]).flat();

export default function Marquee() {
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
