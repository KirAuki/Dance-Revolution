import { useEffect, useRef, useState } from "react";
import {
  applicationOptions,
  limits,
  stepFields,
  validateApplication,
} from "../../shared/application.js";
import { useReducedMotion } from "../hooks/useReducedMotion.js";
import ArrowIcon from "./ArrowIcon.jsx";
import { useSiteSettings } from "../SiteSettings.jsx";

const initialValues = () => ({
  ...Object.fromEntries(Object.keys(limits).map((key) => [key, ""])),
  participantCount: "",
  regulationsAccepted: false,
  personalDataAccepted: false,
});

function Field({
  name,
  label,
  value,
  error,
  onChange,
  options,
  multiline,
  hint,
  required = true,
  ...props
}) {
  const description = hint || (options && value.length > 40 ? value : "");
  const attributes = {
    id: name,
    name,
    value,
    onChange,
    required,
    maxLength: limits[name],
    className: error ? "is-invalid" : undefined,
    "aria-invalid": Boolean(error),
    "aria-describedby": error
      ? `${name}-error`
      : description
        ? `${name}-hint`
        : undefined,
    ...props,
  };
  return (
    <label className="form-field" htmlFor={name}>
      <span className="form-label">
        {label}
        {required && "\u00a0*"}
      </span>
      {options ? (
        <select {...attributes}>
          <option value="">{props.placeholder || "Выберите значение"}</option>
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : multiline ? (
        <textarea {...attributes} />
      ) : (
        <input {...attributes} />
      )}
      {description && <small id={`${name}-hint`}>{description}</small>}
      {error && (
        <small className="field-error" id={`${name}-error`}>
          {error}
        </small>
      )}
    </label>
  );
}

export default function ApplicationForm() {
  const { contacts, documents, home } = useSiteSettings();
  const options = applicationOptions(home);
  const [values, setValues] = useState(initialValues);
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [focusField, setFocusField] = useState(null);
  const formRef = useRef(null);
  const dialogRef = useRef(null);
  const requestRef = useRef(null);
  const submissionRef = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => {
    if (!focusField) return;
    const field = formRef.current.elements.namedItem(focusField);
    const target = field instanceof RadioNodeList ? field[0] : field;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({
      block: "center",
      behavior: reduced ? "auto" : "smooth",
    });
    setFocusField(null);
  }, [step, focusField, reduced]);
  useEffect(() => {
    if (success) dialogRef.current.showModal();
  }, [success]);

  function change(event) {
    const { name, value, type, checked } = event.target;
    setValues((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
      ...(name === "accommodation" && value === "Нет"
        ? { hotelGuests: "" }
        : {}),
    }));
    setErrors((previous) => {
      const next = { ...previous };
      delete next[name];
      return next;
    });
    setAlert("");
  }

  function validateThrough(lastStep) {
    const all = validateApplication(values, home);
    const fields = stepFields.slice(0, lastStep + 1).flat();
    const relevant = Object.fromEntries(
      fields.filter((name) => all[name]).map((name) => [name, all[name]]),
    );
    setErrors(relevant);
    const first = fields.find((name) => relevant[name]);
    if (!first) return true;
    setStep(stepFields.findIndex((group) => group.includes(first)));
    setFocusField(first);
    setAlert("Проверьте обязательные поля заявки.");
    return false;
  }

  function goTo(next) {
    if (submitting || (next > step && !validateThrough(next - 1))) return;
    setStep(next);
    setFurthest((previous) => Math.max(previous, next));
    setAlert("");
    setFocusField(stepFields[next][0]);
  }

  async function submit(event) {
    event.preventDefault();
    if (requestRef.current) return;
    if (step < 2) {
      goTo(step + 1);
      return;
    }
    if (!validateThrough(2)) return;
    const payload = JSON.stringify(values);
    if (submissionRef.current?.payload !== payload)
      submissionRef.current = { payload, key: crypto.randomUUID() };
    const controller = new AbortController();
    requestRef.current = controller;
    setSubmitting(true);
    setAlert("");
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch("/api/application", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": submissionRef.current.key },
        body: payload,
        signal: controller.signal,
      });
      const result = await response.json().catch(() => ({}));
      if (
        !response.ok ||
        typeof result.applicationNumber !== "string" ||
        !result.applicationNumber
      ) {
        throw new Error(result.message || "Не удалось отправить заявку.");
      }
      setSuccess({ number: result.applicationNumber, email: values.email });
      submissionRef.current = null;
      setValues(initialValues());
      setStep(0);
      setFurthest(0);
      setErrors({});
    } catch (error) {
      const message =
        error.name === "AbortError"
          ? "Сервер не ответил вовремя. Повторите отправку: копия той же заявки не создастся."
          : error.message;
      setAlert(
        `${message} Свяжитесь с Оргкомитетом: ${contacts.email} или ${contacts.phone}.`,
      );
    } finally {
      clearTimeout(timeout);
      requestRef.current = null;
      setSubmitting(false);
    }
  }

  const field = (name, label, props = {}) => (
    <Field
      name={name}
      label={label}
      value={values[name]}
      error={errors[name]}
      onChange={change}
      {...props}
    />
  );
  const consent = (name, children) => (
    <label className="check">
      <input
        type="checkbox"
        name={name}
        checked={values[name]}
        onChange={change}
        required
        aria-invalid={Boolean(errors[name])}
        className={errors[name] ? "is-invalid" : undefined}
      />
      <span>
        {children}
        {errors[name] && <small className="field-error">{errors[name]}</small>}
      </span>
    </label>
  );
  const back = (
    <button
      className="button button--outline"
      type="button"
      onClick={() => goTo(step - 1)}
    >
      Назад
    </button>
  );
  const next = (
    <button
      className="button button--lime"
      type="button"
      onClick={() => goTo(step + 1)}
    >
      Далее <ArrowIcon direction="right" />
    </button>
  );

  return (
    <>
      <form
        ref={formRef}
        className="application-form reveal"
        id="application-form"
        noValidate
        onSubmit={submit}
        aria-busy={submitting}
      >
        <div className="form-progress" aria-label="Шаги заявки">
          {["Номер", "Участники", "Контакты"].map((label, index) => (
            <button
              key={label}
              type="button"
              className={
                index === step
                  ? "is-active"
                  : index < step
                    ? "is-complete"
                    : undefined
              }
              aria-current={index === step ? "step" : undefined}
              disabled={index > furthest || submitting}
              aria-disabled={index > furthest || submitting}
              onClick={() => goTo(index)}
            >
              <span>0{index + 1}</span>
              {label}
            </button>
          ))}
        </div>
        <div
          className={`form-alert${alert ? " is-visible" : ""}`}
          id="form-alert"
          role="alert"
          aria-live="polite"
        >
          {alert}
        </div>
        <fieldset
          className={`form-step${step === 0 ? " is-active" : ""}`}
          hidden={step !== 0}
          disabled={submitting}
        >
          <legend>Конкурсный номер</legend>
          {field("collective", "Полное название коллектива", {
            autoComplete: "organization",
          })}
          {field("performanceTitle", "Название конкурсного номера")}
          <div className="form-row">
            {field("participantCount", "Количество участников", {
              type: "number",
              inputMode: "numeric",
              min: options.minParticipants,
              max: options.maxParticipants,
              step: 1,
              hint: `Не менее ${options.minParticipants} человек`,
            })}
            {field("duration", "Хронометраж", {
              inputMode: "text",
              placeholder: "03:30",
              hint: `Не более ${String(Math.floor(options.maxDurationSeconds / 60)).padStart(2, "0")}:${String(options.maxDurationSeconds % 60).padStart(2, "0")}`,
            })}
          </div>
          {field("nomination", "Номинация", {
            options: options.nominations,
            placeholder: "Выберите номинацию",
          })}
          {field("ageCategory", "Возрастная категория", {
            options: options.ages,
            placeholder: "Выберите категорию",
          })}
          {field("professionalLevel", "Профессиональный уровень", {
            options: options.levels,
            placeholder: "Выберите уровень",
          })}
          <div className="form-actions form-actions--end">{next}</div>
        </fieldset>
        <fieldset
          className={`form-step${step === 1 ? " is-active" : ""}`}
          hidden={step !== 1}
          disabled={submitting}
        >
          <legend>Участники и проживание</legend>
          {field("participants", "ФИО всех участников номера", {
            multiline: true,
            rows: 6,
            hint: "Укажите каждого участника с новой строки — данные используются для именных дипломов.",
          })}
          {field("institution", "Наименование учреждения", {
            required: false,
            autoComplete: "organization",
          })}
          <div className="form-row">
            {field("country", "Страна", { autoComplete: "country-name" })}
            {field("city", "Город", { autoComplete: "address-level2" })}
          </div>
          {field("director", "ФИО руководителя")}
          {field("teacher", "ФИО педагога / хореографа")}
          <fieldset className="radio-group">
            <legend>Требуется проживание? *</legend>
            {["Да", "Нет"].map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name="accommodation"
                  value={value}
                  checked={values.accommodation === value}
                  onChange={change}
                  required
                  aria-invalid={Boolean(errors.accommodation)}
                />
                <span>{value}</span>
              </label>
            ))}
            {errors.accommodation && (
              <small className="field-error">{errors.accommodation}</small>
            )}
          </fieldset>
          <label
            className="form-field hotel-guests"
            hidden={values.accommodation !== "Да"}
          >
            <span className="form-label">ФИО всех проживающих&nbsp;*</span>
            <textarea
              name="hotelGuests"
              rows={4}
              maxLength={limits.hotelGuests}
              value={values.hotelGuests}
              onChange={change}
              required={values.accommodation === "Да"}
              aria-invalid={Boolean(errors.hotelGuests)}
              className={errors.hotelGuests ? "is-invalid" : undefined}
            />
            <small>Включая руководителей, педагогов и сопровождающих.</small>
            {errors.hotelGuests && (
              <small className="field-error">{errors.hotelGuests}</small>
            )}
          </label>
          <div className="form-actions">
            {back}
            {next}
          </div>
        </fieldset>
        <fieldset
          className={`form-step${step === 2 ? " is-active" : ""}`}
          hidden={step !== 2}
          disabled={submitting}
        >
          <legend>Контакты и согласия</legend>
          {field("email", "E-mail", { type: "email", autoComplete: "email" })}
          {field("phone", "Телефон", {
            type: "tel",
            autoComplete: "tel",
            inputMode: "tel",
            placeholder: "+7 999 000-00-00",
          })}
          {field("telegram", "Telegram", {
            required: false,
            placeholder: "@username",
          })}
          {field("comment", "Комментарий для Оргкомитета", {
            required: false,
            multiline: true,
            rows: 4,
          })}
          {consent(
            "regulationsAccepted",
            <>
              Я ознакомился(-ась) с{" "}
              <a
                href={documents.regulations}
                download
              >
                Положением конкурса
              </a>{" "}
              и принимаю условия участия.
            </>,
          )}
          {consent(
            "personalDataAccepted",
            <>
              Я принимаю{" "}
              <a href="/consent" target="_blank" rel="noreferrer">
                Согласие на обработку персональных данных
              </a>{" "}
              и ознакомился(-ась) с{" "}
              <a href="/privacy" target="_blank" rel="noreferrer">
                Политикой конфиденциальности
              </a>
              .
            </>,
          )}
          <input
            className="honeypot"
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={values.website}
            onChange={change}
          />
          <div className="form-actions">
            {back}
            <button
              className="button button--lime button--submit"
              type="submit"
              disabled={submitting}
            >
              {submitting ? (
                "Отправляем…"
              ) : (
                <>
                  Отправить заявку <ArrowIcon />
                </>
              )}
            </button>
          </div>
        </fieldset>
      </form>
      <dialog
        ref={dialogRef}
        className="success-dialog"
        aria-labelledby="success-title"
        onClose={() => {
          setSuccess(null);
          setFocusField("collective");
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            event.currentTarget.close();
        }}
      >
        <button
          type="button"
          className="success-dialog__close"
          aria-label="Закрыть"
          onClick={() => dialogRef.current.close()}
        >
          ×
        </button>
        <span>Заявка отправлена</span>
        <h2 id="success-title">Добро пожаловать в революцию.</h2>
        <p>
          {success &&
            `Заявка ${success.number} сохранена. Оргкомитет свяжется с вами по указанным контактам. Уведомление придёт на ${success.email}, когда будет отправлено.`}
        </p>
        <button
          type="button"
          className="button button--lime"
          onClick={() => dialogRef.current.close()}
        >
          Закрыть
        </button>
      </dialog>
    </>
  );
}
