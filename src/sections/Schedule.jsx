export default function Schedule() {
  return (
    <section className="timeline section section--lime" id="schedule">
      <div className="shell section-heading">
        <p className="section-label reveal">10 / Программа для иногородних</p>
        <h2 className="display-title reveal">
          Четыре дня <em className="title-black">в ритме Москвы.</em>
        </h2>
      </div>
      <div className="shell timeline__grid">
        <article className="reveal">
          <time dateTime="2027-04-02">02 апреля</time>
          <strong>Заезд</strong>
          <p>
            Прибытие в Москву, заселение с 14:00, регистрация и организационная
            встреча.
          </p>
        </article>
        <article className="reveal">
          <time dateTime="2027-04-03">03 апреля</time>
          <strong>Конкурс</strong>
          <p>Торжественное открытие и первый день конкурсной программы.</p>
        </article>
        <article className="reveal">
          <time dateTime="2027-04-04">04 апреля</time>
          <strong>Финал</strong>
          <p>Продолжение программы, церемония награждения и Гала-концерт.</p>
        </article>
        <article className="reveal">
          <time dateTime="2027-04-05">05 апреля</time>
          <strong>Выезд</strong>
          <p>Завтрак и выселение из гостиницы до 12:00.</p>
        </article>
      </div>
    </section>
  );
}
