export default function Conditions() {
  return (
    <section className="conditions section section--light" id="conditions">
      <div className="shell conditions__layout">
        <div className="conditions__sticky">
          <p className="section-label reveal">11 / Условия</p>
          <h2 className="display-title display-title--marker reveal">
            Важные <em className="title-marker">сроки.</em>
          </h2>
        </div>
        <div className="deadline-stack">
          <article className="reveal">
            <span>Москва и Московская область</span>
            <strong>до 29 марта 2027</strong>
          </article>
          <article className="reveal">
            <span>Иногородние коллективы</span>
            <strong>до 22 марта 2027</strong>
          </article>
          <article className="reveal">
            <span>Фонограммы WAV или MP3</span>
            <strong>после подтверждения заявки</strong>
            <p>
              Отправляются на dance@revolution-msk.ru. В названии файла укажите
              коллектив и конкурсный номер.
            </p>
          </article>
          <article className="reveal">
            <span>Замена репертуара</span>
            <strong>не позднее чем за 7 дней</strong>
            <p>
              При поздней замене взимается дополнительный организационный взнос
              2 000 ₽.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
