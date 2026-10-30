export default function Categories() {
  return (
    <section className="categories section section--light" id="categories">
      <div className="shell section-heading">
        <p className="section-label reveal">05 / Категории и оценка</p>
        <h2 className="display-title display-title--marker reveal">
          Каждый возраст.
          <br />
          <em className="title-marker">Каждый уровень.</em>
        </h2>
      </div>
      <div className="shell age-strip reveal" aria-label="Возрастные категории">
        <span>5–6</span>
        <span>7–9</span>
        <span>10–12</span>
        <span>13–15</span>
        <span>16–18</span>
        <span>19+</span>
        <span>Смешанная</span>
      </div>
      <div className="shell criteria-grid">
        <article className="criteria-card reveal">
          <span>01</span>
          <strong>Репертуар и возраст</strong>
          <p>Соответствие постановки возрасту исполнителей.</p>
        </article>
        <article className="criteria-card reveal">
          <span>02</span>
          <strong>Номинация</strong>
          <p>Соответствие номера заявленному направлению.</p>
        </article>
        <article className="criteria-card reveal">
          <span>03</span>
          <strong>Техника</strong>
          <p>Исполнительская точность и уровень подготовки.</p>
        </article>
        <article className="criteria-card reveal">
          <span>04</span>
          <strong>Мастерство</strong>
          <p>Актёрская выразительность и сценическая подача.</p>
        </article>
        <article className="criteria-card reveal">
          <span>05</span>
          <strong>Постановка</strong>
          <p>Композиция, драматургия и работа с пространством.</p>
        </article>
        <article className="criteria-card reveal">
          <span>06</span>
          <strong>Костюмы</strong>
          <p>Целостность и соответствие сценическому образу.</p>
        </article>
        <article className="criteria-card reveal">
          <span>07</span>
          <strong>Оригинальность</strong>
          <p>Авторский язык и свежесть художественного решения.</p>
        </article>
      </div>
      <p className="shell category-note reveal">
        Возраст коллектива определяется по возрасту не менее 70% участников.
        Если это условие не выполняется, выбирается категория «Смешанная».
      </p>
    </section>
  );
}
