export default function Awards() {
  return (
    <section className="awards section section--dark" id="awards">
      <div className="shell section-heading section-heading--right">
        <p className="section-label reveal">06 / Награды</p>
        <h2 className="display-title reveal">
          Победа, которая меняет <em>траекторию.</em>
        </h2>
      </div>
      <div className="shell award-grid">
        <article className="award-card award-card--grand reveal">
          <span>Высшая награда</span>
          <strong>Гран-при</strong>
          <p>
            Большой кубок, диплом на коллектив, медали участникам,
            индивидуальные электронные дипломы и денежный приз.
          </p>
          <img
            src="/assets/award-trophy.webp"
            alt="Награда Гран-при"
            width="900"
            height="1200"
            loading="lazy"
          />
          <i aria-hidden="true">
            GRAND
            <br />
            PRIX
          </i>
        </article>
        <article className="award-card award-card--money reveal">
          <span>Главный приз</span>
          <strong>Денежный приз</strong>
          <p>Вручается обладателю Гран-при конкурса.</p>
          <img
            src="/assets/money-prize.webp"
            alt="Торжественное вручение денежного приза"
            width="1200"
            height="700"
            loading="lazy"
          />
        </article>
        <article className="award-card reveal">
          <span>Лауреаты</span>
          <strong>I, II и III степени</strong>
          <p>
            Кубок соответствующей степени, диплом коллективу, медаль и
            электронный диплом каждому участнику.
          </p>
        </article>
        <article className="award-card reveal">
          <span>Дипломанты</span>
          <strong>Награда каждому участнику</strong>
          <p>
            Общий диплом коллективу, фирменная медаль и индивидуальный
            электронный диплом.
          </p>
        </article>
        <article className="award-card reveal">
          <span>Особое признание</span>
          <strong>Призы жюри и партнёров</strong>
          <p>Специальные награды и благодарности руководителям и педагогам.</p>
        </article>
      </div>
    </section>
  );
}
