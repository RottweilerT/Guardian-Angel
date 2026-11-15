import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const J = p => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));

test("Bible : quatre versions complètes et cohérentes", () => {
  const ix = J("../public/bible/index.json");
  assert.deepEqual(ix.versions.map(v => v.code), ["fr", "en", "es", "la"]);
  for (const v of ix.versions) {
    assert.ok(v.livres.length === 73 && /catholique/.test(v.tradition), v.code);
    for (const [b, nom, n] of v.livres) {
      assert.ok(ix.ordre.includes(b) && nom && n > 0, v.code + " " + b);
      const ch = Array.from({ length: n }, (_, i) => J(`../public/bible/${v.code}/${b}/${i + 1}.json`));
      assert.ok(ch.flat().every(x => Array.isArray(x) && typeof x[1] === "string" && (x[1].length || v.code === "es")), v.code + " " + b);
    }
  }
  assert.match(J("../public/bible/fr/JHN/3.json")[15][1], /Dieu a tant aimé le monde/);
  assert.match(J("../public/bible/la/JHN/1.json")[0][1], /In principio erat Verbum/);
  assert.match(J("../public/bible/es/JHN/3.json")[15][1], /amó tanto Dios al mundo/);
});
