import test from "node:test";
import assert from "node:assert/strict";
import { DATE_FILTERS } from "../src/constants/index.js";

test("DATE_FILTERS includes day week month", () => {
  assert.deepEqual(
    DATE_FILTERS.map((item) => item.value),
    ["day", "week", "month"],
  );
});
