export default function Premium() {
  return (
    <section className="premium section section--light" id="premium">
      <div className="shell premium__layout">
        <div className="premium__sticky">
          <p className="section-label reveal">07 / Премия</p>
          <h2 className="display-title display-title--marker reveal">
            10 000 ₽{" "}
            <em className="title-marker">победителю в каждой номинации.</em>
          </h2>
          <p className="section-intro reveal">
            Премии присуждаются по итогам всей конкурсной программы независимо
            от направления и возраста. Жюри вправе не присуждать отдельную
            премию, если ни одна работа не соответствует её уровню.
          </p>
        </div>
        <ol className="premium-list">
          <li className="reveal">
            <span>01</span>
            <strong>Лучший хореографический номер в направлении</strong>
          </li>
          <li className="reveal">
            <span>02</span>
            <strong>Лучшая режиссура хореографической постановки</strong>
          </li>
          <li className="reveal">
            <span>03</span>
            <strong>Лучшее современное прочтение традиций</strong>
          </li>
          <li className="reveal">
            <span>04</span>
            <strong>Лучший хореографический коллектив</strong>
          </li>
          <li className="reveal">
            <span>05</span>
            <strong>Лучшая хореографическая постановка</strong>
          </li>
          <li className="reveal">
            <span>06</span>
            <strong>Лучшее исполнительское мастерство</strong>
          </li>
          <li className="reveal">
            <span>07</span>
            <strong>Лучшее ансамблевое исполнение</strong>
          </li>
          <li className="reveal">
            <span>08</span>
            <strong>Лучший педагог-хореограф</strong>
          </li>
          <li className="reveal">
            <span>09</span>
            <strong>Лучший сценический образ</strong>
          </li>
          <li className="reveal">
            <span>10</span>
            <strong>Открытие года</strong>
          </li>
        </ol>
      </div>
    </section>
  );
}
