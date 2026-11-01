import { useSiteSettings } from "../SiteSettings.jsx";
import { money, dayCount, daysBetween, countLabel } from "../../shared/site-settings.js";

export default function Travel() {
  const { event, hotel, prices } = useSiteSettings();
  const stay = `${dayCount(event.arrivalDate, event.departureDate)} / ${countLabel(daysBetween(event.arrivalDate, event.departureDate), ["ночь", "ночи", "ночей"])}`;
  return (
    <section className="travel section section--dark" id="travel">
      <div className="shell section-heading">
        <p className="section-label reveal">09 / Участникам</p>
        <h2 className="display-title reveal">
          {event.city} встречает <em>вас.</em>
        </h2>
        <p className="section-intro reveal">
          Для иногородних коллективов: проживание {stay}, {hotel.meals.toLowerCase()} и {hotel.transport.toLowerCase()}.
        </p>
      </div>
      <div className="shell hotel-gallery">
        <figure className="hotel-gallery__wide reveal parallax-media">
          <img
            src={hotel.image}
            alt={hotel.name}
            width="1800"
            height="1199"
            loading="lazy"
          />
          <figcaption>
            {hotel.name} · {hotel.address}
          </figcaption>
        </figure>
        <figure className="reveal">
          <img
            src={hotel.roomImage}
            alt={hotel.roomDescription}
            width="1600"
            height="1067"
            loading="lazy"
          />
          <figcaption>{hotel.roomDescription}</figcaption>
        </figure>
      </div>
      <div className="shell price-grid">
        <article className="price-card price-card--lime reveal">
          <span>{event.localLabel}</span>
          <strong>{money(prices.localFirst)}</strong>
          <small>за участника в первом номере</small>
          <ul>
            <li>Медаль каждому участнику</li>
            <li>Индивидуальный электронный диплом</li>
            <li>Фото- и видеорепортаж</li>
            <li>Фирменный мерч</li>
          </ul>
          <p>Второй и последующий номер — {money(prices.localAdditional)} за человека.</p>
        </article>
        <article className="price-card reveal">
          <span>Иногородний участник</span>
          <strong>{money(prices.travelParticipant)}</strong>
          <small>за одного участника</small>
          <ul>
            <li>Проживание {stay}</li>
            <li>{hotel.meals}</li>
            <li>{hotel.transport}</li>
            <li>Конкурс, медаль, диплом и мерч</li>
          </ul>
        </article>
        <article className="price-card reveal">
          <span>Сопровождающий</span>
          <strong>{money(prices.companion)}</strong>
          <small>за одного человека</small>
          <ul>
            <li>Проживание {stay}</li>
            <li>{hotel.meals}</li>
            <li>{hotel.transport}</li>
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
