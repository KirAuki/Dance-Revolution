import { useSiteSettings } from "../SiteSettings.jsx";

export default function Jury() {
  const { jury } = useSiteSettings();
  return (
    <section className="jury section section--light" id="jury">
      <div className="shell jury__heading">
        <div>
          <p className="section-label reveal">08 / Жюри</p>
          <h2 className="display-title display-title--marker reveal">
            Те, кто знает сцену <em className="title-marker">изнутри.</em>
          </h2>
        </div>
        <p className="section-intro reveal">
          Хореографы, артисты, режиссёры и продюсеры, которые формируют индустрию сегодня.
        </p>
      </div>
      <div className="shell jury__grid" style={{ "--jury-columns": Math.min(jury.length, 5) }}>
        {jury.map((person, index) => (
          <article className="jury-card reveal" key={index}>
            <div className="jury-card__photo" role="img" aria-label={person.name}>
              <div
                className="jury-card__portrait"
                aria-hidden="true"
                style={person.image
                  ? { backgroundImage: `url("${person.image}")`, backgroundSize: "cover", backgroundPosition: "center" }
                  : person.spriteIndex !== null
                    ? { "--position": `${person.spriteIndex * 25}%` }
                    : { backgroundImage: "none" }}
              >
                {!person.image && person.spriteIndex === null && person.name.split(/\s+/).slice(0, 2).map(part => part[0]).join("")}
              </div>
            </div>
            <div className="jury-card__body">
              <span className="jury-card__number">{String(index + 1).padStart(2, "0")}</span>
              <h3>{person.name}</h3>
              <strong>{person.role}</strong>
              <p>{person.bio}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
