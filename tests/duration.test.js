import test from "node:test";
import assert from "node:assert/strict";
import { durationFromParts, pastedDuration } from "../shared/duration.js";
import { validateApplication } from "../shared/application.js";
import { validApplication } from "./fixtures.js";

test("separate duration fields preserve zero minutes and reject malformed numbers", () => {
  for (const [minutes, seconds, expected] of [["", "30", "00:30"], ["4", "", "04:00"], ["03", "5", "03:05"], ["", "", ""], ["2.5", "", ""], ["003", "", ""], ["-1", "30", ""], ["3", "1e1", ""]]) {
    assert.equal(durationFromParts({ minutes, seconds }), expected);
  }
  for (const parts of [{ minutes: "0", seconds: "0" }, { minutes: "3", seconds: "60" }, { minutes: "4", seconds: "1" }]) {
    assert.ok(validateApplication({ ...validApplication, duration: durationFromParts(parts) }).duration);
  }
});

test("pasted clock and compact formats are equivalent without rounding invalid seconds", () => {
  for (const input of ["3:30", "03:30", " 3.30 ", "3,30", "3 30", "3 : 30", "330", "0330"]) {
    assert.equal(durationFromParts(pastedDuration(input)), "03:30");
  }
  for (const input of ["", "3", "30", "3.5", "3:30:00", "3e2", "-130", "03:300", "x330", "3".repeat(100)]) {
    assert.equal(pastedDuration(input), null);
  }
  const invalid = durationFromParts(pastedDuration("3:60"));
  assert.equal(invalid, "03:60");
  assert.ok(validateApplication({ ...validApplication, duration: invalid }).duration);
});
