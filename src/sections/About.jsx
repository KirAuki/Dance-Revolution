import Counter from "../components/Counter.jsx";

export default function About() {
  return (
    <section className="about section section--light" id="about">
      <div className="shell about__grid">
        <p className="section-label reveal">01 / О проекте</p>
        <div>
          <h2 className="display-title display-title--marker reveal">
            Здесь начинается{" "}
            <em className="title-marker">новая культура танца.</em>
          </h2>
          <div className="about__copy reveal">
            <p>
              «Танцевальная революция» — международная премия-конкурс для
              профессиональных и самодеятельных хореографических коллективов.
            </p>
            <p>
              Два конкурсных дня объединят большую сцену, профессиональную
              оценку, денежные премии и возможности для дальнейшего творческого
              развития.
            </p>
          </div>
        </div>
      </div>
      <div className="shell facts-grid">
        <article className="fact reveal">
          <Counter value={2} suffix="" />
          <span>конкурсных дня</span>
        </article>
        <article className="fact reveal">
          <Counter value={15} suffix="+" />
          <span>направлений</span>
        </article>
        <article className="fact reveal">
          <Counter value={7} suffix="" />
          <span>возрастных категорий</span>
        </article>
        <article className="fact fact--dark reveal">
          <strong>5+</strong>
          <span>участников в коллективе</span>
        </article>
      </div>
    </section>
  );
}
