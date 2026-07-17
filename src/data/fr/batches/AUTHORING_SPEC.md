# FR question authoring spec (cloze-first, multi-tag)

You author French quiz questions and write them as `{ "questions": [ ... ] }` JSON.
Every question tests ONE thing at the blank. Follow this EXACTLY.

## Per-question JSON shape

```json
{
  "id": "fr_w2_<prefix>_001",
  "format": "cloze",
  "level": 2,
  "cue": "Hier soir, nous ___ au restaurant.",
  "blankHint": "manger",
  "translation": "Last night we ate at the restaurant.",
  "tags": [
    { "facet": "grammar", "tag": "passe_compose", "role": "focus" },
    { "facet": "topic", "tag": "restaurant", "role": "context" }
  ],
  "options": ["avons mangé", "mangeons", "avons mangés", "as mangé"],
  "correct_index": 0,
  "explanation": "Passé composé avec « avoir » : nous avons mangé.",
  "register": "neutral"
}
```

## Two authoring modes

**GRAMMAR-FOCUS** (the blank tests a grammatical form):
- Focus tag = the grammar tag being tested (`role: "focus"`).
- Add 1–2 `topic` CONTEXT tags describing the sentence subject (`role: "context"`).
- `blankHint` = the INFINITIVE/lemma of the verb filling the blank (for conjugation tags). For article/negation/pronoun/preposition blanks set `blankHint: null`. For adjective-agreement, hint = masculine-singular base form.
- Distractors = plausible wrong FORMS (wrong person/tense/auxiliary/agreement).

**VOCAB-FOCUS** (the blank tests knowing a word):
- Focus tag = the `topic` tag (`role: "focus"`). `blankHint: null` ALWAYS.
- The blank is a content word (noun/verb/adjective) from that topic.
- Distractors = other real words from the SAME topic that don't fit (semantic confusions).

## Hard rules
- `format`: "cloze"; `cue` contains EXACTLY ONE `___`.
- `options`: EXACTLY 4 distinct French strings; `options[0]` is correct; `correct_index` ALWAYS 0.
- `translation`: natural full English translation of the completed sentence.
- `explanation`: ONE short French sentence.
- `register`: "casual" | "neutral" | "formal" (optional). Do NOT use other values.
- `id`: unique, using YOUR assigned prefix. Natural, correct French. No duplicate cues.
- At least ≥1 focus tag. Tags must come from the taxonomy (lists below).

## Coverage requirement
For EACH assigned tag, author **≥6 questions at EACH level in its range** (6, not 5, to safely clear the graduation floor). Spread difficulty naturally within each CEFR level.

## Allowed grammar tags
present_etre_avoir, present_reguliers, present_irreguliers, present_pronominaux, passe_compose, aux_avoir, aux_etre, accord_participe, imparfait, pc_vs_imparfait, plus_que_parfait, futur_proche, futur_simple, conditionnel, subjonctif, si_hypothese, pronom_cod, pronom_coi, pronom_y_en, pronom_combinaisons, relatif_qui_que, relatif_dont_ou_lequel, prepositions_lieu, prepositions_verbe, articles_definis_indefinis, article_partitif, de_apres_negation, negation_base, negation_rien_personne, ne_que, accord_adjectif, comparatif_superlatif, discours_rapporte, connecteurs_logiques

## Allowed topic tags
daily_routine, weather_time, clothing, shopping_courses, transport_daily, restaurant, food_ingredients, cooking_methods, home_rooms, furniture_objects, housing_admin, work_email, meetings, job_contract, body_health, symptoms_doctor, travel_booking, directions, emotions_feelings, family_relations, friendship_social, apologies_conflict, politeness, admin_bureaucracy, media_news, numbers_stats, idioms, register_formal

Levels: 1=A1, 2=A2, 3=B1, 4=B2, 5=C1.
