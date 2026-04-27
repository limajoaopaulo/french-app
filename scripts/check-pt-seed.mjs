import fs from "node:fs"

const s = JSON.parse(fs.readFileSync("src/data/pt/seed.json", "utf8"))
const t = JSON.parse(fs.readFileSync("src/data/pt/taxonomy.json", "utf8"))

console.log("questions:", s.questions.length)

const patterns = new Set()
for (const [, dv] of Object.entries(t.domains)) {
  for (const [, sv] of Object.entries(dv.subs)) {
    for (const p of sv.patterns) patterns.add(p)
  }
}

const unknown = s.questions.filter((q) => !patterns.has(q.pattern))
console.log("unknown patterns:", unknown.length)
if (unknown.length) {
  console.log(unknown.slice(0, 10).map((q) => `${q.id} -> ${q.pattern}`))
}

const byDomainSub = {}
for (const q of s.questions) {
  const k = `${q.domain}/${q.sub}`
  byDomainSub[k] = (byDomainSub[k] ?? 0) + 1
}
console.log(byDomainSub)

const ids = s.questions.map((q) => q.id)
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
console.log("unique dup ids:", new Set(dupes).size)
if (dupes.length) console.log("samples:", [...new Set(dupes)].slice(0, 10))

const badOpts = s.questions.filter(
  (q) => !Array.isArray(q.options) || q.options.length !== 4,
)
console.log("bad options:", badOpts.length)

const nonZero = s.questions.filter((q) => q.correct_index !== 0)
console.log("non-zero correct_index:", nonZero.length)
if (nonZero.length) {
  console.log("nonzero samples:", nonZero.slice(0, 5).map((q) => `${q.id} idx=${q.correct_index}`))
}
