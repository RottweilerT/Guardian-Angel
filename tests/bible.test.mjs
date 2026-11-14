import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const J = p => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));

test("Bible : quatre versions complètes et cohérentes", () => {
  const ix = J("../public/bible/index.json");
  assert.deepEqual(ix.versions.map(v => v.code), ["fr", "en", "la"]);
  for (const v of ix.versions) {
    assert.ok(v.livres.length === 73 && /catholique/.test(v.tradition), v.code);
    for (const [b, nom, n] of v.livres) {
      assert.ok(ix.ordre.includes(b) && nom && n > 0, v.code + " " + b);
      const ch = J(`../public/bible/${v.code}/${b}.json`);
      assert.equal(ch.length, n, v.code + " " + b);
      assert.ok(ch.flat().every(x => Array.isArray(x) && typeof x[1] === "string" && x[1].length), v.code + " " + b);
    }
  }
  assert.match(J("../public/bible/fr/JHN.json")[2][15][1], /Dieu a tant aimé le monde/);
  assert.match(J("../public/bible/la/JHN.json")[0][0][1], /In principio erat Verbum/);
});
