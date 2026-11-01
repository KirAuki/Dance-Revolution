import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { SiteSettingsContext, initialSiteSettings } from "./SiteSettings.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <SiteSettingsContext.Provider value={initialSiteSettings()}>
      <App />
    </SiteSettingsContext.Provider>
  </StrictMode>,
);
