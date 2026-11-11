// Inputs keep their own text while editing; only complete numbers become payload data.
export function durationFromParts({ minutes, seconds }) {
  if ((!minutes && !seconds) || !/^\d{0,2}$/.test(minutes) || !/^\d{0,2}$/.test(seconds)) return "";
  return `${(minutes || "0").padStart(2, "0")}:${(seconds || "0").padStart(2, "0")}`;
}

export function pastedDuration(value) {
  const text = value.trim();
  if (text.length > 16) return null;
  // A dot/comma separates minutes and seconds, never decimal minutes: 3.30.
  const parts = text.match(/^(\d{1,2})\s*[:.,]\s*(\d{2})$/)
    || text.match(/^(\d{1,2})\s+(\d{2})$/)
    || text.match(/^(\d{1,2})(\d{2})$/);
  return parts ? { minutes: parts[1], seconds: parts[2] } : null;
}
