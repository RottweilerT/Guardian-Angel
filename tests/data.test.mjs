import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { validateDay } from "../scripts/lectures-schema.mjs";

const dir = new URL("../data/lectures/", import.meta.url);

test("chaque fichier de data/lectures est valide", () => {
  const files = readdirSync(dir).filter(f => f.endsWith(".json"));
  assert.ok(files.length > 0);
  for (const f of files) {
    assert.match(f, /^\d{4}-\d{2}-\d{2}\.json$/, "nom de fichier : " + f);
    const errs = validateDay(JSON.parse(readFileSync(new URL(f, dir), "utf8")), f.slice(0, 10));
    assert.deepEqual(errs, [], f);
  }
});

test("le validateur repère les erreurs", () => {
  assert.ok(validateDay({ date: "2026-11-08", lectures: [{ type: "lecture9" }] }, "2026-11-08").length);
  assert.ok(validateDay({ date: "2026-11-08", lectures: [] }, "2026-11-09").length);
  assert.ok(validateDay({ date: "2026-11-08", couleur: "bleu", lectures: [{ type: "evangile" }] }).length);
  assert.deepEqual(validateDay({ date: "2026-11-08", lectures: [{ type: "evangile", ref: "Mt 25, 1-13" }] }, "2026-11-08"), []);
});
