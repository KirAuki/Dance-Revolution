import test from "node:test";
import assert from "node:assert/strict";
import { validateApplication } from "../shared/application.js";


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
