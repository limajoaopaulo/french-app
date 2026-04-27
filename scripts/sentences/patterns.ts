export type PatternEntry =
  | { kind: "regex"; patterns: RegExp[]; note?: string }
  | { kind: "keywords"; keywords: string[]; note?: string }

export const GRAMMAR_PATTERNS: Record<string, PatternEntry> = {
  // present_conjugation
  "present-etre-avoir": {
    kind: "regex",
    patterns: [/\b(je suis|tu es|il est|elle est|nous sommes|vous êtes|ils sont|elles sont|j'ai|tu as|il a|elle a|nous avons|vous avez|ils ont|elles ont)\b/i],
  },
  "present-pronominal": {
    kind: "regex",
    patterns: [/\b(me|te|se|nous|vous)\s+\w+(e|es|ent|ons|ez)\b/i],
    note: "Matches reflexive forms; false positives on direct-object pronouns.",
  },
  "present-irregular-core": {
    kind: "regex",
    patterns: [/\b(vais|vas|va|allons|allez|vont|fais|fait|faites|font|dis|dit|disons|dites|disent|peux|peut|pouvons|pouvez|peuvent|veux|veut|voulons|voulez|veulent|dois|doit|devons|devez|doivent|sais|sait|savons|savez|savent|viens|vient|venons|venez|viennent)\b/i],
  },

  // past_tenses
  "pc-avoir": {
    kind: "regex",
    patterns: [/(?:^|\s|')(?:ai|as|a|avons|avez|ont)\s+\w+(?:é|i|u|is|it|ert|eint|ait)(?=\s|[.,!?;:'"]|$)/i],
    note: "Catches 'il a mangé' but also 'il a froid' (false positive — author filters).",
  },
  "pc-etre-accord": {
    kind: "regex",
    patterns: [/\b(?:suis|es|est|sommes|êtes|sont)\s+\w+(?:é|ée|és|ées|i|ie|is|ies)(?=\s|[.,!?;:'"]|$)/i],
  },
  "imparfait-description": {
    kind: "regex",
    patterns: [/\b\w+(?:ais|ait|ions|iez|aient)\b/i],
    note: "Also matches conditionnel (-rais/-rait); author distinguishes.",
  },
  "imparfait-habitude": {
    kind: "regex",
    patterns: [/\b(?:tous les|chaque|souvent|toujours|quand j'étais|quand il était)\b.*\b\w+(?:ais|ait|ions|iez|aient)\b/i],
  },
  "pc-vs-imparfait": {
    kind: "regex",
    patterns: [
      /\b\w+(?:ais|ait)\b.*(?:^|\s|')(?:ai|as|a|avons|ont|est|sont)\s+\w+(?:é|i|u)(?=\s|[.,!?;:'"]|$)/i,
      /(?:^|\s|')(?:ai|as|a|avons|ont|est|sont)\s+\w+(?:é|i|u)(?=\s|[.,!?;:'"]|$).*\b\w+(?:ais|ait)\b/i,
    ],
    note: "Requires both imparfait and PC in one sentence — rare in ≤6-word sources; use --source fr-16000.",
  },
  "plus-que-parfait": {
    kind: "regex",
    patterns: [/\b(?:avais|avait|avions|aviez|avaient|étais|était|étions|étiez|étaient)\s+\w+(?:é|ée|és|ées|i|is|u|us)(?=\s|[.,!?;:'"]|$)/i],
  },

  // future_conditional
  "futur-simple": {
    kind: "regex",
    patterns: [/\b\w+(erai|eras|era|erons|erez|eront|irai|iras|ira|irons|irez|iront|rai|ras|ra|rons|rez|ront)\b/i],
    note: "Verb-final futur; confusion with conditionnel (-rais) possible — authors check.",
  },
  "futur-proche": {
    kind: "regex",
    patterns: [/\b(vais|vas|va|allons|allez|vont)\s+\w+(er|ir|re|oir)\b/i],
  },
  "conditionnel-present": {
    kind: "regex",
    patterns: [/\b\w+(rais|rait|rions|riez|raient)\b/i],
  },
  "conditionnel-passe": {
    kind: "regex",
    patterns: [/\b(aurais|aurait|aurions|auriez|auraient|serais|serait|serions|seriez|seraient)\s+\w+(é|i|u|is|it)\b/i],
  },
  "si-concordance": {
    kind: "regex",
    patterns: [/\bsi\s+\w+/i],
    note: "Broad — 'si' clause of any type. Narrow with --pattern si-type1 / si-type2.",
  },

  // subjunctive
  "subj-trigger-doute": {
    kind: "regex",
    patterns: [/\b(je doute que|pas sûr que|pas certain que|il se peut que|il est possible que|il n'est pas évident que)\b/i],
  },
  "subj-trigger-volonte": {
    kind: "regex",
    patterns: [/\b(je veux que|j'aimerais que|je souhaite que|il faut que|j'exige que|je voudrais que|il est nécessaire que)\b/i],
  },
  "subj-trigger-emotion": {
    kind: "regex",
    patterns: [/\b(je suis content que|je suis triste que|je regrette que|j'ai peur que|je suis heureux que|je suis surpris que|je suis désolé que)\b/i],
  },
  "subj-trigger-conjonction": {
    kind: "regex",
    patterns: [/\b(bien que|quoique|pour que|afin que|avant que|jusqu'à ce que|à moins que|pourvu que|sans que)\b/i],
  },
  "subj-trigger-impersonnel": {
    kind: "regex",
    patterns: [/\b(il faut que|il est important que|il est essentiel que|il est nécessaire que|il est normal que|il vaut mieux que)\b/i],
  },

  // pronouns_personal
  "pronom-cod": {
    kind: "regex",
    patterns: [/\b(le|la|les|l')\s+\w+(e|es|ent|ons|ez|é|ée|és|ées)\b/i],
    note: "Broad — also catches articles. Author filters.",
  },
  "pronom-coi": {
    kind: "regex",
    patterns: [/\b(lui|leur|me|te|nous|vous)\s+(ai|as|a|avons|avez|ont|dis|dit|donne|donnes|donne|donnons|donnez|donnent|parle|parles|parlent|réponds|répond)\b/i],
  },
  "pronom-y": {
    kind: "regex",
    patterns: [/\by\s+\w+/i, /\bj'y\b/i],
  },
  "pronom-en": {
    kind: "regex",
    patterns: [/\ben\s+(ai|as|a|avons|avez|ont|veux|veut|voulons|voulez|veulent|prends|prend|prennent|mange|manges|mangent)\b/i, /\bj'en\b/i],
  },
  "pronom-combinaisons": {
    kind: "regex",
    patterns: [/\b(me le|me la|me les|te le|te la|te les|le lui|la lui|les lui|le leur|la leur|les leur|m'en|t'en|lui en|leur en|m'y|t'y|lui y)\b/i],
  },

  // relative_pronouns
  "relatif-qui": {
    kind: "regex",
    patterns: [/\bqui\b/i],
    note: "Also catches interrogative 'qui'. Author filters.",
  },
  "relatif-que": {
    kind: "regex",
    patterns: [/\b(que|qu')\b/i],
    note: "Very broad (includes conjonction 'que'). Use with --limit high + manual review.",
  },
  "relatif-ou": {
    kind: "regex",
    patterns: [/\b(où|là où)\b/i],
  },
  "relatif-dont": {
    kind: "regex",
    patterns: [/\bdont\b/i],
  },
  "relatif-lequel": {
    kind: "regex",
    patterns: [/\b(lequel|laquelle|lesquels|lesquelles|auquel|auxquels|auxquelles|duquel|desquels|desquelles)\b/i],
  },

  // prepositions
  "prep-a-ville": {
    kind: "regex",
    patterns: [/\bà\s+[A-ZÀ-Ü]\w+/],
    note: "Matches 'à + capitalised name' — proxy for city. False positives on names.",
  },
  "prep-en-pays-feminin": {
    kind: "regex",
    patterns: [/\ben\s+(France|Italie|Espagne|Allemagne|Chine|Russie|Angleterre|Belgique|Suisse|Grèce|Turquie|Pologne|Norvège|Suède|Finlande|Irlande|Argentine|Australie|Colombie|Égypte)\b/],
  },
  "prep-au-pays-masculin": {
    kind: "regex",
    patterns: [/\bau\s+(Japon|Canada|Portugal|Brésil|Mexique|Maroc|Sénégal|Vietnam|Cambodge|Pérou|Chili|Danemark)\b/],
  },
  "prep-de-origine": {
    kind: "regex",
    patterns: [/\b(viens|vient|venons|venez|viennent|suis|es|est)\s+(de|du|des|d')\s+\w/i],
  },
  "verbe-prep-a-inf": {
    kind: "regex",
    patterns: [/\b(commencer|commence|commences|commencent|hésiter|hésite|hésites|apprendre|apprend|apprends|réussir|réussit|réussis|arriver|arrive|arrives|chercher|cherche|cherches|tenir|tient|tiens|aider|aide|aides|inviter|invite|invites|penser|pense|penses)\s+à\s+\w+(er|ir|re|oir)\b/i],
  },
  "verbe-prep-de-inf": {
    kind: "regex",
    patterns: [/\b(décider|décide|décides|refuser|refuse|refuses|éviter|évite|évites|choisir|choisit|choisis|essayer|essaie|essaies|promettre|promet|promets|accepter|accepte|acceptes|finir|finit|finis|arrêter|arrête|arrêtes|oublier|oublie|oublies)\s+de\s+\w+(er|ir|re|oir)\b/i],
  },

  // articles_determiners
  "article-partitif": {
    kind: "regex",
    patterns: [/\b(du|de la|de l'|des)\s+\w+/i],
    note: "Also catches 'de la' as preposition + article. Review.",
  },
  "de-apres-negation": {
    kind: "regex",
    patterns: [/\b(ne|n')\s+\w+\s+(pas|plus|jamais|point)\s+(de|d')\s+\w+/i],
  },
  "possessif-demonstratif": {
    kind: "regex",
    patterns: [/\b(ce|cet|cette|ces|mon|ma|mes|ton|ta|tes|son|sa|ses|notre|nos|votre|vos|leur|leurs)\b/i],
    note: "Very broad. Filter by level or narrow context.",
  },

  // negation — (?:ne\s+|n') handles elision where n' has no following space
  "ne-pas": {
    kind: "regex",
    patterns: [/\b(?:ne\s+|n')\w+\s+pas\b/i],
  },
  "ne-plus": {
    kind: "regex",
    patterns: [/\b(?:ne\s+|n')\w+\s+plus\b/i],
  },
  "ne-jamais": {
    kind: "regex",
    patterns: [/\b(?:ne\s+|n')\w+\s+jamais\b/i],
  },
  "ne-rien": {
    kind: "regex",
    patterns: [/\b(?:ne\s+|n')\w+\s+rien\b/i, /\brien\s+(?:ne\s+|n')\w+/i],
  },
  "ne-personne": {
    kind: "regex",
    patterns: [/\b(?:ne\s+|n')\w+(?:\s+\w+)?\s+personne\b/i, /\bpersonne\s+(?:ne\s+|n')\w+/i],
  },
  "ne-que": {
    kind: "regex",
    patterns: [/\b(?:ne\s+|n')\w+\s+que\b/i],
  },

  // complex_sentences
  "reported-present": {
    kind: "regex",
    patterns: [/\b(dit|dis|disent|explique|expliquent|indique|indiquent|annonce|annoncent|pense|pensent|croit|croient|affirme|affirment)\s+(que|qu')/i],
  },
  "reported-passe": {
    kind: "regex",
    patterns: [/\b(a dit|ai dit|as dit|avez dit|ont dit|a expliqué|a annoncé|a indiqué|a pensé|a cru|a affirmé)\s+(que|qu')/i],
    note: "Rare in ≤6-word sources — prefer fr-16000.",
  },
  "si-type1": {
    kind: "regex",
    patterns: [/\bsi\s+\S+(?:e|es|ons|ez|ent|is|it|issons|issez|issent)\b.*\b\w+(?:rai|ras|ra|rons|rez|ront)\b/i],
    note: "Needs present + futur in one sentence. \\S+ tolerates elision like 'j''.",
  },
  "si-type2": {
    kind: "regex",
    patterns: [/\bsi\s+\S+(?:ais|ait|ions|iez|aient)\b.*\b\w+(?:rais|rait|rions|riez|raient)\b/i],
    note: "Needs imparfait + conditionnel — prefer fr-16000.",
  },
  "connecteurs-logiques": {
    kind: "regex",
    patterns: [/\b(donc|cependant|pourtant|néanmoins|toutefois|en revanche|par ailleurs|par conséquent|en effet|ainsi|tandis que|alors que|bien que|quoique|parce que|car|puisque|tant que|dès que|aussitôt que)\b/i],
  },
}

export const VOCAB_PATTERNS: Record<string, PatternEntry> = {
  // daily_life
  "daily_life/routine-matinale": { kind: "keywords", keywords: ["lève", "réveil", "douche", "brosse", "petit-déjeuner", "habille"] },
  "daily_life/temps-meteo": { kind: "keywords", keywords: ["pleut", "neige", "soleil", "nuage", "froid", "chaud", "vent", "canicule", "orage"] },
  "daily_life/vetements": { kind: "keywords", keywords: ["pull", "pantalon", "robe", "chemise", "chaussure", "manteau", "veste", "porter", "essayer"] },
  "daily_life/courses": { kind: "keywords", keywords: ["courses", "marché", "supermarché", "caisse", "payer", "carte bancaire", "boulangerie"] },
  "daily_life/transports-quotidiens": { kind: "keywords", keywords: ["métro", "bus", "tram", "train", "vélo", "voiture", "bouchon", "station", "arrêt"] },

  // food_cooking
  "food_cooking/ingredients-base": { kind: "keywords", keywords: ["farine", "sucre", "sel", "poivre", "beurre", "lait", "œuf", "huile"] },
  "food_cooking/methodes-cuisson": { kind: "keywords", keywords: ["cuire", "bouillir", "mijoter", "griller", "rôtir", "frire", "saisir", "four", "poêle"] },
  "food_cooking/au-restaurant": { kind: "keywords", keywords: ["restaurant", "addition", "menu", "carte", "serveur", "commander", "plat", "réserver"] },
  "food_cooking/plats-typiques": { kind: "keywords", keywords: ["cassoulet", "coq au vin", "ratatouille", "bouillabaisse", "tartiflette", "fromage", "baguette"] },
  "food_cooking/preferences-alimentaires": { kind: "keywords", keywords: ["végétarien", "végan", "allergique", "régime", "sans gluten", "bio"] },

  // home_logistics
  "home_logistics/pieces-maison": { kind: "keywords", keywords: ["chambre", "cuisine", "salon", "salle de bain", "balcon", "appartement", "pièce"] },
  "home_logistics/mobilier-objets": { kind: "keywords", keywords: ["canapé", "table", "chaise", "lit", "armoire", "étagère", "tiroir", "meuble"] },
  "home_logistics/locatif-baux": { kind: "keywords", keywords: ["loyer", "bail", "caution", "dépôt de garantie", "charges", "préavis", "propriétaire", "locataire"] },
  "home_logistics/reparations-entretien": { kind: "keywords", keywords: ["fuite", "panne", "cassé", "plombier", "électricien", "réparer", "poubelle", "ménage"] },

  // work_career
  "work_career/email-formel": { kind: "keywords", keywords: ["cordialement", "monsieur", "madame", "veuillez", "ci-joint", "agréer", "salutations", "suite à"] },
  "work_career/reunions": { kind: "keywords", keywords: ["réunion", "ordre du jour", "compte rendu", "reporter", "participer", "animer"] },
  "work_career/contrats-salaire": { kind: "keywords", keywords: ["contrat", "CDI", "CDD", "salaire", "brut", "net", "prime", "période d'essai", "licencié"] },
  "work_career/competences-cv": { kind: "keywords", keywords: ["CV", "curriculum", "expérience", "compétence", "diplôme", "anglais", "courant"] },
  "work_career/entreprise-roles": { kind: "keywords", keywords: ["chef", "patron", "directeur", "manager", "collègue", "RH", "supérieur", "stagiaire", "télétravail"] },

  // health_body
  "health_body/parties-corps": { kind: "keywords", keywords: ["tête", "dos", "jambe", "bras", "main", "pied", "genou", "épaule", "ventre"] },
  "health_body/symptomes-maladies": { kind: "keywords", keywords: ["fièvre", "rhume", "grippe", "toux", "mal de tête", "nausée", "fatigue", "gorge"] },
  "health_body/medecin-visite": { kind: "keywords", keywords: ["médecin", "docteur", "rendez-vous", "ordonnance", "prescrit", "consultation", "généraliste"] },
  "health_body/urgences": { kind: "keywords", keywords: ["urgences", "ambulance", "pompiers", "SAMU", "accident", "secours"] },
  "health_body/bien-etre": { kind: "keywords", keywords: ["sport", "yoga", "méditation", "repos", "se reposer", "détendre", "stress"] },

  // travel_transport
  "travel_transport/billets-reservations": { kind: "keywords", keywords: ["billet", "aller-retour", "aller simple", "réserver", "TGV", "avion", "gare", "aéroport"] },
  "travel_transport/hebergement": { kind: "keywords", keywords: ["hôtel", "chambre", "auberge", "airbnb", "chambre d'hôtes", "réception", "départ"] },
  "travel_transport/directions-orientation": { kind: "keywords", keywords: ["gauche", "droite", "tout droit", "carrefour", "feu", "demi-tour", "tourner"] },
  "travel_transport/douane-visa": { kind: "keywords", keywords: ["douane", "passeport", "visa", "frontière", "titre de séjour", "déclarer"] },
  "travel_transport/accidents-retards": { kind: "keywords", keywords: ["retard", "annulé", "grève", "bouchon", "perturbation", "interrompu"] },

  // emotions_social
  "emotions_social/sentiments-base": { kind: "keywords", keywords: ["content", "heureux", "triste", "fâché", "inquiet", "déçu", "fier", "jaloux", "ému"] },
  "emotions_social/relations-famille": { kind: "keywords", keywords: ["mère", "père", "frère", "sœur", "cousin", "neveu", "beau-père", "belle-mère", "oncle", "tante"] },
  "emotions_social/amitie-amour": { kind: "keywords", keywords: ["ami", "amie", "amoureux", "compagnon", "compagne", "copain", "copine", "aimer", "manquer"] },
  "emotions_social/conflits-excuses": { kind: "keywords", keywords: ["désolé", "pardon", "excuses", "dispute", "fâché", "brouillé", "se réconcilier", "excuser"] },
  "emotions_social/politesse-sociale": { kind: "keywords", keywords: ["merci", "s'il vous plaît", "bonjour", "au revoir", "enchanté", "je vous en prie"] },

  // admin_bureaucracy
  "admin_bureaucracy/banque-compte": { kind: "keywords", keywords: ["banque", "compte", "virement", "découvert", "carte bancaire", "RIB", "conseiller"] },
  "admin_bureaucracy/impots-taxes": { kind: "keywords", keywords: ["impôt", "impôts", "déclaration", "fiscal", "prélèvement à la source", "avis d'imposition"] },
  "admin_bureaucracy/caf-aides": { kind: "keywords", keywords: ["CAF", "APL", "RSA", "allocation", "allocataire", "aide"] },
  "admin_bureaucracy/papiers-identite": { kind: "keywords", keywords: ["carte d'identité", "passeport", "titre de séjour", "préfecture", "justificatif", "mairie"] },
  "admin_bureaucracy/assurance": { kind: "keywords", keywords: ["assurance", "sinistre", "constat", "franchise", "indemniser", "tous risques"] },

  // media_news
  "media_news/titres-presse": { kind: "keywords", keywords: ["journal", "presse", "article", "hebdomadaire", "quotidien", "titre", "une"] },
  "media_news/debat-politique": { kind: "keywords", keywords: ["élection", "président", "gouvernement", "ministre", "parlement", "loi", "suffrage", "veto"] },
  "media_news/reseaux-sociaux": { kind: "keywords", keywords: ["Twitter", "Instagram", "Facebook", "TikTok", "viral", "partager", "poster", "compte"] },
  "media_news/evenements-actualite": { kind: "keywords", keywords: ["manifestation", "grève", "séisme", "incendie", "attentat", "enquête", "victime"] },
  "media_news/chiffres-statistiques": { kind: "keywords", keywords: ["pourcentage", "%", "chômage", "inflation", "hausse", "baisse", "INSEE", "sur dix"] },

  // register_nuance
  "register_nuance/familier-tutoiement": { kind: "keywords", keywords: ["trop cool", "ouais", "ouf", "fauché", "bof", "t'inquiète", "chelou", "dingue"] },
  "register_nuance/soutenu-formel": { kind: "keywords", keywords: ["je me permets", "je vous saurais gré", "force est de", "sauf votre respect", "permettez-moi"] },
  "register_nuance/argot-verlan": { kind: "keywords", keywords: ["meuf", "mec", "ouf", "chelou", "relou", "teuf", "vénère", "kiffer"] },
  "register_nuance/idiomes-courants": { kind: "keywords", keywords: ["coûter les yeux", "chat dans la gorge", "mettre la charrue", "poser un lapin", "avoir le cafard", "faire la tête"] },
  "register_nuance/politesse-indirecte": { kind: "keywords", keywords: ["pourriez-vous", "serait-il possible", "auriez-vous", "sans vouloir", "me permettez-vous"] },
}

export const ALL_PATTERNS: Record<string, PatternEntry> = {
  ...GRAMMAR_PATTERNS,
  ...VOCAB_PATTERNS,
}
