import { createContext, useContext } from "react";
import { defaultSiteSettings } from "../shared/site-settings.js";

export const SiteSettingsContext = createContext(defaultSiteSettings);
export const useSiteSettings = () => useContext(SiteSettingsContext);

export function initialSiteSettings() {
  const data = document.getElementById("site-settings");
  return data ? JSON.parse(data.textContent) : defaultSiteSettings;
}
