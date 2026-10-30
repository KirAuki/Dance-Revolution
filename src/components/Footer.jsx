export default function Footer() {
  return (
    <footer className="footer" id="contacts">
      <div className="shell footer__hero">
        <a className="footer__logo" href="#top">
          <span>ТАНЦЕВАЛЬНАЯ</span>
          <strong>революция</strong>
        </a>
        <a className="footer__mail" href="mailto:akulov@media-msk.ru">
          akulov@media-msk.ru ↗
        </a>
      </div>
      <div className="shell footer__grid">
        <div>
          <span>Оргкомитет</span>
          <a href="tel:+79256577717">+7 925 657-77-17</a>
          <small>ежедневно с 11:00 до 20:00</small>
        </div>
        <div>
          <span>Мессенджеры</span>
          <a href="https://t.me/dancermsk" target="_blank" rel="noreferrer">
            Telegram @dancermsk
          </a>
          <a
            href="https://max.ru/+79256577717"
            target="_blank"
            rel="noreferrer"
          >
            MAX +7 925 657-77-17
          </a>
        </div>
        <div>
          <span>Фонограммы</span>
          <a href="mailto:dance@revolution-msk.ru">dance@revolution-msk.ru</a>
          <small>WAV или MP3 после подтверждения</small>
        </div>
        <div>
          <span>Документы</span>
          <a
            href="/docs/polozhenie-tancevalnaya-revolyutsiya-2027.docx"
            download
          >
            Положение
          </a>
          <a href="/privacy.html">Политика конфиденциальности</a>
          <a href="/consent.html">Согласие на обработку ПД</a>
        </div>
      </div>
      <div className="shell footer__bottom">
        <span>© 2027 «Танцевальная революция»</span>
        <span>Организатор: ИП Шубенко Дмитрий Геннадьевич</span>
        <span>Москва</span>
      </div>
    </footer>
  );
}
