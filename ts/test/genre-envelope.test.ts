import { expect, test } from "bun:test";
import { envelopeExemptions, genreReference, rosterRows } from "../scripts/genreEnvelopeData";
import { envelopeFailures } from "../scripts/genreEnvelope";

test("hit frame structure, gross frame outliers and stale design exemptions satisfy the reviewed genre ruling [k4 reference genre-envelope]", () => {
  const reference = genreReference();
  const rows = rosterRows(true);
  expect(envelopeFailures(rows, reference.envelope, reference.tolerances, envelopeExemptions())).toEqual([]);
});
