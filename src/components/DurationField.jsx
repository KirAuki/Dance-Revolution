import { useRef } from "react";
import { pastedDuration } from "../../shared/duration.js";

export default function DurationField({ value, onChange, error, maxSeconds }) {
  const secondsRef = useRef(null);
  const maximum = `${String(Math.floor(maxSeconds / 60)).padStart(2, "0")}:${String(maxSeconds % 60).padStart(2, "0")}`;

  function paste(event) {
    const parts = pastedDuration(event.clipboardData.getData("text"));
    if (!parts) return;
    event.preventDefault();
    onChange(parts);
    secondsRef.current?.focus();
  }

  return <fieldset className="form-field duration-field">
    <legend className="form-label">Хронометраж&nbsp;*</legend>
    <div className="duration-field__inputs">
      <label>
        <span>мин</span>
        <input
          name="durationMinutes"
          aria-label="Минуты"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={40}
          placeholder="0"
          value={value.minutes}
          onChange={event => onChange({ ...value, minutes: event.target.value })}
          onKeyDown={event => {
            if ([":", ".", ",", " "].includes(event.key) && /^\d{1,2}$/.test(value.minutes)) {
              event.preventDefault();
              secondsRef.current?.focus();
              secondsRef.current?.select();
            }
          }}
          onPaste={paste}
          className={error ? "is-invalid" : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={`duration-hint${error ? " duration-error" : ""}`}
        />
      </label>
      <span className="duration-field__separator" aria-hidden="true">:</span>
      <label>
        <span>сек</span>
        <input
          ref={secondsRef}
          name="durationSeconds"
          aria-label="Секунды"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={40}
          placeholder="00"
          value={value.seconds}
          onChange={event => onChange({ ...value, seconds: event.target.value })}
          onPaste={paste}
          className={error ? "is-invalid" : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={`duration-hint${error ? " duration-error" : ""}`}
        />
      </label>
    </div>
    <small id="duration-hint">Не более {maximum}. Можно вставить 3:30, 3.30 или 330.</small>
    {error && <small className="field-error" id="duration-error">{error}</small>}
  </fieldset>;
}
