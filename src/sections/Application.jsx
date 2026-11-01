import ApplicationForm from "../components/ApplicationForm.jsx";
import { useSiteSettings } from "../SiteSettings.jsx";
import { eventRange } from "../../shared/site-settings.js";

export default function Application() {
  const { event } = useSiteSettings();
  return (
    <section className="application section section--dark" id="application">
      <div className="shell application__layout">
        <div className="application__intro">
          <p className="section-label reveal">13 / Заявка</p>
          <h2 className="display-title reveal">
            Твоя сцена начинается <em>здесь.</em>
          </h2>
          <div className="application__meta reveal">
            <span>{event.city}</span>
            <strong>{eventRange(event.startDate, event.endDate)}</strong>
            <small>После отправки подтверждение придёт на e-mail.</small>
          </div>
        </div>
        <ApplicationForm />
      </div>
    </section>
  );
}
