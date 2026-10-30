import Accordion from "../components/Accordion.jsx";

const items = [
  {
    title: "Детский танец",
    description: "Для возрастной категории 5–6 лет.",
  },
  {
    title: "Народный танец",
    description: "Народно-сценические постановки и традиционная хореография.",
  },
  {
    title: "Народный стилизованный танец",
    description: "Современное сценическое прочтение народных традиций.",
  },
  {
    title: "Классический танец",
    description: "Классическая школа и балетная хореография.",
  },
  {
    title: "Деми-классика",
    description: "Авторские постановки на основе классической техники.",
  },
  {
    title: "Бально-спортивный танец",
    description: "Ансамблевые номера в бальной и спортивной хореографии.",
  },
  {
    title: "Эстрадный танец",
    description: "Сценические эстрадные постановки.",
  },
  {
    title: "Современный танец",
    description:
      "Модерн, джаз-модерн, джаз, contemporary, диско, степ и другие направления.",
  },
  {
    title: "Клубный (уличный) танец",
    description:
      "Locking, Popping, Hip-Hop, House, Break-Dance, Crump, Whacking, Vogue, Street Jazz, Dancehall, C-Walk, Electro.",
  },
  {
    title: "Танцевальное шоу",
    description: "Зрелищные сюжетные и синтетические сценические постановки.",
  },
  {
    title: "Черлидинг",
    description: "Командные хореографические программы.",
  },
  {
    title: "Восточный танец",
    description:
      "Классические и современные направления восточной хореографии.",
  },
  {
    title: "Цирковая хореография",
    description: "Постановки на стыке хореографии и циркового искусства.",
  },
  {
    title: "Гимнастический танец",
    description: "Хореографические номера с элементами гимнастики.",
  },
  {
    title: "Другие направления",
    description: "Принимаются в соответствии с одобренными заявками.",
  },
];

export default function Nominations() {
  return (
    <section className="nominations section section--lime" id="nominations">
      <div className="shell nominations__layout">
        <div className="nominations__intro">
          <p className="section-label reveal">04 / Номинации</p>
          <h2 className="display-title reveal">
            Ваш язык <em className="title-black">движения.</em>
          </h2>
          <p className="section-intro reveal">
            Выберите точное направление из Положения. Другие хореографические
            направления принимаются по согласованию с Оргкомитетом.
          </p>
        </div>
        <Accordion
          className="nomination-list reveal"
          items={items}
          numbered
          defaultOpen={0}
        />
      </div>
    </section>
  );
}
