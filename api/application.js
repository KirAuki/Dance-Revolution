import { randomBytes } from "node:crypto";

import {
  validateApplication,
  normalizeApplication,
} from "../shared/application.js";

const clean = (value, limit = 500) =>
  String(value ?? "")
    .trim()
    .slice(0, limit);
const escapeHtml = (value) =>
  clean(value, 10000)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
const multiline = (value) => escapeHtml(value).replaceAll(/\r?\n/g, "<br>");
const row = (label, value) =>
  `<tr><td style="padding:10px 14px;color:#777;border-bottom:1px solid #e8e8e2;vertical-align:top;width:210px">${escapeHtml(label)}</td><td style="padding:10px 14px;border-bottom:1px solid #e8e8e2;vertical-align:top">${multiline(value) || "—"}</td></tr>`;

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ message: "Метод не поддерживается." });
  }

  if (
    !request.body ||
    typeof request.body !== "object" ||
    Array.isArray(request.body)
  ) {
    return response
      .status(400)
      .json({ message: "Некорректный формат заявки." });
  }

  const data = normalizeApplication(request.body);
  if (data.website)
    return response.status(200).json({ applicationNumber: "TR-2027" });

  const validationError = Object.values(validateApplication(request.body))[0];
  if (validationError)
    return response.status(400).json({ message: validationError });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey)
    return response
      .status(503)
      .json({ message: "Почтовая отправка ещё не настроена." });

  const participantCount = Number(request.body.participantCount);
  const applicationNumber = `TR-2027-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
  const submittedAt = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Moscow",
  }).format(new Date());
  const from =
    process.env.APPLICATION_FROM_EMAIL ||
    "Танцевальная революция <onboarding@resend.dev>";
  const to = process.env.APPLICATION_TO_EMAIL || "akulov@media-msk.ru";

  const organizerHtml = `
    <div style="font-family:Arial,sans-serif;color:#10100f;max-width:760px;margin:auto">
      <div style="background:#cbff00;padding:24px"><strong style="font-size:24px">Новая заявка · ${applicationNumber}</strong></div>
      <p style="font-size:16px">Отправлена ${escapeHtml(submittedAt)}.</p>
      <table style="width:100%;border-collapse:collapse;font-size:15px">
        ${row("Коллектив", data.collective)}${row("Конкурсный номер", data.performanceTitle)}${row("Количество участников", participantCount)}${row("Хронометраж", data.duration)}${row("Номинация", data.nomination)}${row("Возраст", data.ageCategory)}${row("Профессиональный уровень", data.professionalLevel)}${row("Участники", data.participants)}${row("Учреждение", data.institution)}${row("Страна / город", `${data.country}, ${data.city}`)}${row("Руководитель", data.director)}${row("Педагог / хореограф", data.teacher)}${row("Проживание", data.accommodation)}${row("Проживающие", data.hotelGuests)}${row("E-mail", data.email)}${row("Телефон", data.phone)}${row("Telegram", data.telegram)}${row("Комментарий", data.comment)}
      </table>
      <p style="color:#666;font-size:12px">Заявитель подтвердил принятие Положения, согласие на обработку персональных данных и наличие согласий на фото- и видеосъёмку.</p>
    </div>`;

  const applicantHtml = `
    <div style="font-family:Arial,sans-serif;color:#10100f;max-width:620px;margin:auto">
      <div style="background:#050505;color:#fff;padding:30px"><small style="color:#cbff00;text-transform:uppercase">Танцевальная революция · 2027</small><h1 style="margin:14px 0 0;font-size:34px">Заявка получена</h1></div>
      <div style="padding:28px;border:1px solid #e2e2dc;border-top:0">
        <p>Здравствуйте! Мы получили заявку коллектива «${escapeHtml(data.collective)}» на номер «${escapeHtml(data.performanceTitle)}».</p>
        <p><strong>Номер заявки: ${applicationNumber}</strong></p>
        <p>Оргкомитет проверит данные и направит подтверждение участия. Если ответа не будет в течение 5 дней, напишите на <a href="mailto:akulov@media-msk.ru">akulov@media-msk.ru</a> или позвоните по номеру +7 925 657-77-17.</p>
        <p style="margin-top:28px;color:#666;font-size:13px">Москва · КЗ «Останкино» · 3–4 апреля 2027 года</p>
      </div>
    </div>`;

  try {
    const resendResponse = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          from,
          to: [to],
          reply_to: data.email,
          subject: `Новая заявка ${applicationNumber} · ${data.collective}`,
          html: organizerHtml,
        },
        {
          from,
          to: [data.email],
          subject: `Заявка ${applicationNumber} получена`,
          html: applicantHtml,
        },
      ]),
    });
    if (!resendResponse.ok) {
      console.error(
        "Email provider rejected application:",
        resendResponse.status,
      );
      throw new Error("Email delivery failed");
    }
    return response.status(200).json({ applicationNumber });
  } catch (error) {
    console.error("Application delivery failed:", error.name);
    return response
      .status(502)
      .json({ message: "Письмо не отправилось. Попробуйте ещё раз." });
  }
}
