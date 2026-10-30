export default function Format() {
  return (
    <section className="stage section section--dark" id="format">
      <div className="shell section-heading section-heading--right">
        <p className="section-label reveal">02 / Формат</p>
        <h2 className="display-title reveal">
          Энергия <em>большой сцены.</em>
        </h2>
      </div>
      <div className="shell stage__visual reveal parallax-media">
        <img
          src="/assets/dancers-stage.webp"
          alt="Хореографический коллектив выступает на современной сцене"
          width="1600"
          height="900"
        />
        <div className="stage__stamp" aria-hidden="true">
          <span>03</span>
          <strong>АПРЕЛЯ</strong>
        </div>
        <div className="stage__caption">
          <span>КОНКУРСНАЯ ПРОГРАММА</span>
          <strong>до 4 минут на номер</strong>
        </div>
      </div>
      <div className="shell format-grid">
        <article className="reveal">
          <span>01</span>
          <h3>Только коллективы</h3>
          <p>
            К участию принимаются составы от 5 человек. Соло, дуэты и малые
            формы не участвуют.
          </p>
        </article>
        <article className="reveal">
          <span>02</span>
          <h3>Профессиональные уровни</h3>
          <p>
            От молодых ансамблей без звания до народных, заслуженных и
            образцовых коллективов.
          </p>
        </article>
        <article className="reveal">
          <span>03</span>
          <h3>Оценка каждого номера</h3>
          <p>
            Жюри оценивает выступления по десятибалльной системе на основании
            семи критериев.
          </p>
        </article>
        <article className="reveal">
          <span>04</span>
          <h3>Награждение 4 апреля</h3>
          <p>
            Лауреаты, дипломанты, Гран-при, специальные призы и отдельная
            премиальная программа.
          </p>
        </article>
      </div>
    </section>
  );
}
