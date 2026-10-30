export default function Travel() {
  return (
    <section className="travel section section--dark" id="travel">
      <div className="shell section-heading">
        <p className="section-label reveal">09 / Участникам</p>
        <h2 className="display-title reveal">
          Москва встречает <em>вас.</em>
        </h2>
        <p className="section-intro reveal">
          Для иногородних коллективов предусмотрены проживание 4 дня / 3 ночи,
          трёхразовое питание и транспортное обслуживание.
        </p>
      </div>
      <div className="shell hotel-gallery">
        <figure className="hotel-gallery__wide reveal parallax-media">
          <img
            src="/assets/beta-hotel-day.webp"
            alt="Дневной вид гостиницы «Бета Измайлово» в Москве"
            width="1800"
            height="1199"
            loading="lazy"
          />
          <figcaption>
            «Бета Измайлово» 3* · Измайловское ш., 71, корп. 2Б
          </figcaption>
        </figure>
        <figure className="reveal">
          <img
            src="/assets/beta-hotel-room-v2.webp"
            alt="Стандартный номер гостиницы «Бета Измайлово»"
            width="1600"
            height="1067"
            loading="lazy"
          />
          <figcaption>Стандартный двухместный номер</figcaption>
        </figure>
      </div>
      <div className="shell price-grid">
        <article className="price-card price-card--lime reveal">
          <span>Москва и Московская область</span>
          <strong>3 500 ₽</strong>
          <small>за участника в первом номере</small>
          <ul>
            <li>Медаль каждому участнику</li>
            <li>Индивидуальный электронный диплом</li>
            <li>Фото- и видеорепортаж</li>
            <li>Фирменный мерч</li>
          </ul>
          <p>Второй и последующий номер — 3 000 ₽ за человека.</p>
        </article>
        <article className="price-card reveal">
          <span>Иногородний участник</span>
          <strong>19 500 ₽</strong>
          <small>за одного участника</small>
          <ul>
            <li>Проживание 4 дня / 3 ночи</li>
            <li>Трёхразовое питание</li>
            <li>Транспортное обслуживание</li>
            <li>Конкурс, медаль, диплом и мерч</li>
          </ul>
        </article>
        <article className="price-card reveal">
          <span>Сопровождающий</span>
          <strong>16 000 ₽</strong>
          <small>за одного человека</small>
          <ul>
            <li>Проживание 4 дня / 3 ночи</li>
            <li>Трёхразовое питание</li>
            <li>Транспортное обслуживание</li>
            <li>Организационное сопровождение</li>
          </ul>
        </article>
      </div>
      <p className="shell currency-note reveal">
        Цены указаны в российских рублях. Стоимость в KZT и BYN рассчитывается
        по курсу на дату подачи заявки.
      </p>
    </section>
  );
}
