import test from "node:test";
import assert from "node:assert/strict";
import { validateApplication } from "../shared/application.js";
import handler from "../api/application.js";
import { defaultSiteSettings } from "../shared/site-settings.js";
import { validApplication } from "./fixtures.js";

test("duration and participant limits are enforced at both boundaries", () => {
  for (const duration of ["00:01", "03:59", "04:00", "4:00"])
    assert.deepEqual(
      validateApplication({ ...validApplication, duration }),
      {},
    );
  for (const duration of ["00:00", "04:01", "03:60", "04:000", "240", "abc"])
    assert.ok(validateApplication({ ...validApplication, duration }).duration);
  for (const participantCount of [5, 500, "5", "500"])
    assert.deepEqual(
      validateApplication({ ...validApplication, participantCount }),
      {},
    );
  for (const participantCount of [4, 501, 5.5, "", [5], true, null])
    assert.ok(
      validateApplication({ ...validApplication, participantCount })
        .participantCount,
    );
});

test("hotel guests, consents, field types and untruncated field limits are validated", () => {
  assert.ok(
    validateApplication({ ...validApplication, accommodation: "Да" })
      .hotelGuests,
  );
  assert.deepEqual(
    validateApplication({
      ...validApplication,
      accommodation: "Да",
      hotelGuests: "Гость",
    }),
    {},
  );
  for (const name of ["regulationsAccepted", "personalDataAccepted"]) {
    assert.ok(
      validateApplication({ ...validApplication, [name]: "true" })[name],
    );
  }
  assert.ok(
    validateApplication({ ...validApplication, collective: " ".repeat(2) })
      .collective,
  );
  assert.ok(
    validateApplication({ ...validApplication, collective: "x".repeat(181) })
      .collective,
  );
  assert.ok(
    validateApplication({ ...validApplication, collective: {} }).collective,
  );
  assert.ok(
    validateApplication({ ...validApplication, nomination: "Unknown" })
      .nomination,
  );
  assert.ok(
    validateApplication({ ...validApplication, email: "a@b@c.com" }).email,
  );
  assert.ok(
    validateApplication({ ...validApplication, phone: "abcdefg" }).phone,
  );
});

function response() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("API rejects unsupported methods, malformed bodies and invalid applications", async () => {
  for (const [request, expected] of [
    [{ method: "GET" }, 405],
    [{ method: "POST", body: [] }, 400],
    [{ method: "POST", body: { ...validApplication, duration: "05:00" } }, 400],
  ]) {
    const result = response();
    await handler(request, result);
    assert.equal(result.statusCode, expected);
    assert.equal(result.headers["Cache-Control"], "no-store");
  }
});

test("API fails honestly without credentials and handles provider failures without sending real mail", async (t) => {
  const original = process.env.RESEND_API_KEY;
  t.after(() => {
    if (original === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = original;
  });
  delete process.env.RESEND_API_KEY;
  const missing = response();
  await handler({ method: "POST", body: validApplication }, missing);
  assert.equal(missing.statusCode, 503);

  process.env.RESEND_API_KEY = "test-only";
  const mail = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    mail.push(JSON.parse(options.body));
    assert.equal(url, "https://api.resend.com/emails/batch");
    assert.ok(options.signal);
    return { ok: true };
  });
  const result = response();
  await handler(
    {
      method: "POST",
      body: { ...validApplication, collective: "<img src=x onerror=alert(1)>" },
    },
    result,
  );
  assert.equal(result.statusCode, 200);
  assert.match(result.body.applicationNumber, /^TR-2027-/);
  assert.equal(mail[0].length, 2);
  assert.ok(mail[0][0].html.includes("&lt;img"));
  assert.ok(!mail[0][0].html.includes("<img src=x"));
  const settings = structuredClone(defaultSiteSettings);
  settings.event.startDate = "2028-05-03";
  settings.event.endDate = "2028-05-04";
  settings.event.city = "Тула";
  settings.contacts.email = "updated@example.com";
  const updated = response();
  await handler({method:"POST", body:validApplication, siteSettings:settings}, updated);
  assert.match(updated.body.applicationNumber, /^TR-2028-/);
  assert.ok(mail[1][1].html.includes("3–4 мая 2028"));
  assert.ok(mail[1][1].html.includes("updated@example.com"));
  assert.ok(!mail[1][1].html.includes(defaultSiteSettings.contacts.email));
  globalThis.fetch.mock.mockImplementation(async () => ({
    ok: false,
    status: 429,
  }));
  const failed = response();
  await handler({ method: "POST", body: validApplication }, failed);
  assert.equal(failed.statusCode, 502);
});
