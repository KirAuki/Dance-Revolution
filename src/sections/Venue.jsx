export default function Venue() {
  return (
    <section className="venue section section--light" id="venue">
      <div className="shell section-heading">
        <p className="section-label reveal">03 / Площадка</p>
        <h2 className="display-title display-title--marker reveal">
          Сцена, которую <em className="title-marker">видела вся страна.</em>
        </h2>
        <p className="section-intro reveal">
          Концертный зал «Останкино» — ул. Академика Королёва, 15, корп. 2.
          Конкурс пройдёт в одном из самых узнаваемых телевизионных районов
          Москвы.
        </p>
      </div>
      <div className="shell photo-story photo-story--single">
        <figure className="photo-story__main reveal parallax-media">
          <img
            src="/assets/ostankino-venue.webp"
            alt="Сцена и зрительный зал концертного зала «Останкино»"
            width="1800"
            height="1200"
            loading="lazy"
          />
          <figcaption>
            <span>01</span> Концертный зал «Останкино»
          </figcaption>
        </figure>
        <div className="photo-story__note reveal">
          <strong>
            03–04
            <br />
            04·2027
          </strong>
          <p>Один зал для всей конкурсной программы и общего финала.</p>
          <a
            className="text-link"
            href="https://yandex.ru/profile/1053713542?lang=ru&amp;ysclid=ms2gvwyf0287236650"
            target="_blank"
            rel="noreferrer"
          >
            Открыть маршрут ↗
          </a>
        </div>
      </div>
    </section>
  );
}
