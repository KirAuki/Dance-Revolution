import HeroVideo from "../components/HeroVideo.jsx";

export default function Hero() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <HeroVideo />
      <div className="hero__shade"></div>
      <div className="hero__signal" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div className="shell hero__content">
        <p className="eyebrow reveal">
          Международная премия-конкурс в сфере хореографического искусства
        </p>
        <div className="hero__date reveal">
          <time dateTime="2027-04-03">03–04 / 04 / 2027</time>
          <span>Москва</span>
        </div>
        <h1 id="hero-title" className="hero__title reveal">
          <span>ТАНЦЕВАЛЬНАЯ</span>
          <strong>РЕВОЛЮЦИЯ</strong>
        </h1>
        <p className="hero__lead reveal">
          Два конкурсных дня на большой московской сцене — для хореографических
          коллективов из России и стран ближнего зарубежья.
        </p>
        <div className="hero__actions reveal">
          <a className="button button--lime button--large" href="#application">
            Подать заявку <span>↗</span>
          </a>
          <a
            className="button button--ghost button--large"
            href="/docs/polozhenie-tancevalnaya-revolyutsiya-2027.docx"
            download
          >
            Скачать положение <span>↓</span>
          </a>
        </div>
      </div>
      <div className="shell hero__meta reveal">
        <div>
          <span>Даты</span>
          <strong>3–4 апреля 2027</strong>
        </div>
        <div>
          <span>Город</span>
          <strong>Москва</strong>
        </div>
        <div>
          <span>Площадка</span>
          <a
            href="https://yandex.ru/profile/1053713542?lang=ru&amp;ysclid=ms2gvwyf0287236650"
            target="_blank"
            rel="noreferrer"
          >
            КЗ «Останкино» ↗
          </a>
        </div>
      </div>
    </section>
  );
}
