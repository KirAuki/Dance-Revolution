import { useSiteSettings } from "../SiteSettings.jsx";

function JuryName({ name }) {
  const [first, ...rest] = name.trim().split(/\s+/);
  return (
    <h3 className="jury-card__name">
      <span>{first}</span>
      {rest.length > 0 && <> <span>{rest.join(" ")}</span></>}
    </h3>
  );
}

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
                className={`jury-card__portrait${!person.image && person.spriteIndex === null ? " jury-card__portrait--placeholder" : ""}`}
                aria-hidden="true"
                style={person.image
                  ? { backgroundImage: `url("${person.image}")`, backgroundSize: "cover", backgroundPosition: "center top" }
                  : person.spriteIndex !== null
                    ? { "--position": `${person.spriteIndex * 25}%` }
                    : undefined}
              >
                {!person.image && person.spriteIndex === null && (
                  <>
                    <span className="jury-card__question">?</span>
                    <span className="jury-card__teaser">Новое имя</span>
                  </>
                )}
              </div>
            </div>
            <div className="jury-card__body">
              <JuryName name={person.name} />
              <strong>{person.role}</strong>
              {person.bio && <p>{person.bio}</p>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
