import ApplicationForm from "../components/ApplicationForm.jsx";

export default function Application() {
  return (
    <section className="application section section--dark" id="application">
      <div className="shell application__layout">
        <div className="application__intro">
          <p className="section-label reveal">13 / Заявка</p>
          <h2 className="display-title reveal">
            Твоя сцена начинается <em>здесь.</em>
          </h2>
          <div className="application__meta reveal">
            <span>Москва</span>
            <strong>3–4 апреля 2027</strong>
            <small>После отправки подтверждение придёт на e-mail.</small>
          </div>
        </div>
        <ApplicationForm />
      </div>
    </section>
  );
}
