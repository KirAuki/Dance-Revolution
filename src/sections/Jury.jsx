export default function Jury() {
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
          Хореографы, артисты, режиссёры и продюсеры, которые формируют
          индустрию сегодня.
        </p>
      </div>
      <div className="shell jury__grid">
        <article className="jury-card reveal">
          <div
            className="jury-card__photo"
            style={{ "--position": "0%" }}
            role="img"
            aria-label="Александра Миронова"
          ></div>
          <span>01</span>
          <h3>Александра Миронова</h3>
          <strong>Хореограф-постановщик</strong>
          <p>
            Автор постановок для больших сценических шоу и международных
            танцевальных проектов.
          </p>
        </article>
        <article className="jury-card reveal">
          <div
            className="jury-card__photo"
            style={{ "--position": "25%" }}
            role="img"
            aria-label="Максим Волков"
          ></div>
          <span>02</span>
          <h3>Максим Волков</h3>
          <strong>Артист и режиссёр</strong>
          <p>
            Эксперт по сценическому образу, драматургии номера и работе
            исполнителя со зрителем.
          </p>
        </article>
        <article className="jury-card reveal">
          <div
            className="jury-card__photo"
            style={{ "--position": "50%" }}
            role="img"
            aria-label="Екатерина Орлова"
          ></div>
          <span>03</span>
          <h3>Екатерина Орлова</h3>
          <strong>Педагог-хореограф</strong>
          <p>
            Специалист по современной хореографии, технике исполнения и развитию
            молодых артистов.
          </p>
        </article>
        <article className="jury-card reveal">
          <div
            className="jury-card__photo"
            style={{ "--position": "75%" }}
            role="img"
            aria-label="Артём Соколов"
          ></div>
          <span>04</span>
          <h3>Артём Соколов</h3>
          <strong>Креативный продюсер</strong>
          <p>
            Создаёт концертные программы и помогает талантам превращать сильный
            номер в событие.
          </p>
        </article>
        <article className="jury-card reveal">
          <div
            className="jury-card__photo"
            style={{ "--position": "100%" }}
            role="img"
            aria-label="Мария Белова"
          ></div>
          <span>05</span>
          <h3>Мария Белова</h3>
          <strong>Балетмейстер</strong>
          <p>
            Лауреат профессиональных премий, эксперт по композиции, ансамблю и
            сценической культуре.
          </p>
        </article>
      </div>
    </section>
  );
}
