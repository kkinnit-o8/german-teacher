/**
 * Hand-curated German function words.
 *
 * Wiktionary's data for articles and pronouns is irregular, and these words
 * are the most frequent in any text, so they are defined here instead.
 *
 * Each family counts as ONE learned word: every form of der/die/das, of ein,
 * of mein and so on. Personal pronouns are one family per person
 * (ich/mich/mir, du/dich/dir, ...): beginners learn the case forms together,
 * and the Learn card shows all of them. Each form keeps its own short gloss
 * ("mir" -> "(to) me") so unlearned forms are still glossed precisely.
 */
import type { Pos } from "../dict/types";

export interface FunctionFamily {
  /** unique key, "lemma|pos" */
  key: string;
  lemma: string;
  /** how the Learn card and word list show it */
  display: string;
  pos: Pos;
  meanings: string[];
  /** lowercase form -> short gloss for that form */
  forms: Record<string, string>;
  /** forms that only belong to this family when capitalised mid-sentence (Sie, Ihnen, Ihr) */
  capitalOnly?: boolean;
}

const fam = (
  key: string,
  display: string,
  meanings: string[],
  forms: Record<string, string>,
  extra: Partial<FunctionFamily> = {},
): FunctionFamily => {
  const [lemma, pos] = key.split("|");
  return { key, lemma, display, pos: pos as Pos, meanings, forms, ...extra };
};

export const FUNCTION_FAMILIES: FunctionFamily[] = [
  fam("der|art", "der, die, das", ["the", "that, who, which (as a pronoun)"], {
    der: "the",
    die: "the",
    das: "the",
    den: "the",
    dem: "(to) the",
    des: "of the",
  }),
  fam("dessen|pron", "dessen, deren, denen", ["whose; (to) whom, which"], {
    dessen: "whose",
    deren: "whose, their",
    denen: "(to) whom, which",
    derer: "of those",
  }),
  fam("ein|art", "ein, eine", ["a, an", "one (as a pronoun)"], {
    ein: "a",
    eine: "a",
    einen: "a",
    einem: "(to) a",
    einer: "a, one",
    eines: "of a",
  }),
  fam("kein|det", "kein, keine", ["no, not a, not any"], {
    kein: "no",
    keine: "no",
    keinen: "no",
    keinem: "no",
    keiner: "no, nobody",
    keines: "no",
    keins: "none",
  }),
  fam("mein|det", "mein, meine", ["my"], {
    mein: "my",
    meine: "my",
    meinen: "my",
    meinem: "my",
    meiner: "my",
    meines: "my",
    meins: "mine",
  }),
  fam("dein|det", "dein, deine", ["your (to one friend)"], {
    dein: "your",
    deine: "your",
    deinen: "your",
    deinem: "your",
    deiner: "your",
    deines: "your",
    deins: "yours",
  }),
  fam("sein|det", "sein, seine", ["his, its"], {
    sein: "his",
    seine: "his",
    seinen: "his",
    seinem: "his",
    seiner: "his",
    seines: "his",
    seins: "his",
  }),
  fam("ihr|det", "ihr, ihre", ["her, their; Ihr: your (formal)"], {
    ihr: "her, their",
    ihre: "her, their",
    ihren: "her, their",
    ihrem: "her, their",
    ihrer: "her, their",
    ihres: "her, their",
    ihrs: "hers, theirs",
  }),
  fam("unser|det", "unser, unsere", ["our"], {
    unser: "our",
    unsere: "our",
    unseren: "our",
    unserem: "our",
    unserer: "our",
    unseres: "our",
    unsre: "our",
    unsren: "our",
    unsrem: "our",
    unsrer: "our",
  }),
  fam("euer|det", "euer, eure", ["your (to several friends)"], {
    euer: "your",
    eure: "your",
    euren: "your",
    eurem: "your",
    eurer: "your",
    eures: "your",
  }),
  fam("dieser|det", "dieser, diese, dieses", ["this, these"], {
    dieser: "this",
    diese: "this, these",
    dieses: "this",
    diesen: "this",
    diesem: "this",
    dies: "this",
  }),
  fam("jeder|det", "jeder, jede, jedes", ["every, each"], {
    jeder: "every, everyone",
    jede: "every",
    jedes: "every",
    jeden: "every",
    jedem: "every",
  }),
  fam("welcher|det", "welcher, welche, welches", ["which"], {
    welcher: "which",
    welche: "which",
    welches: "which",
    welchen: "which",
    welchem: "which",
  }),
  fam("jener|det", "jener, jene, jenes", ["that, those"], {
    jener: "that",
    jene: "that, those",
    jenes: "that",
    jenen: "that, those",
    jenem: "that",
  }),
  fam("solcher|det", "solcher, solche", ["such"], {
    solcher: "such",
    solche: "such",
    solches: "such",
    solchen: "such",
    solchem: "such",
  }),
  fam("mancher|det", "mancher, manche", ["some, many a"], {
    mancher: "some",
    manche: "some",
    manches: "some",
    manchen: "some",
    manchem: "some",
  }),
  fam("alle|det", "alle", ["all, everyone"], {
    alle: "all",
    allen: "all",
    aller: "of all",
    allem: "all",
  }),
  fam("alles|pron", "alles", ["everything"], { alles: "everything" }),
  fam("ich|pron", "ich (mich, mir)", ["I (mich: me, mir: to me)"], {
    ich: "I",
    mich: "me",
    mir: "(to) me",
    meiner: "of me",
  }),
  fam("du|pron", "du (dich, dir)", ["you (to one friend)"], {
    du: "you",
    dich: "you",
    dir: "(to) you",
  }),
  fam("er|pron", "er (ihn, ihm)", ["he, it (ihn: him, ihm: to him)"], {
    er: "he, it",
    ihn: "him, it",
    ihm: "(to) him",
  }),
  fam("sie|pron", "sie (ihr, ihnen)", ["she, they (ihr: to her, ihnen: to them)"], {
    sie: "she, they",
    ihr: "(to) her",
    ihnen: "(to) them",
  }),
  fam("es|pron", "es", ["it"], { es: "it" }),
  fam("wir|pron", "wir (uns)", ["we (uns: us)"], { wir: "we", uns: "us" }),
  fam("ihr|pron", "ihr (euch)", ["you (to several friends)"], { ihr: "you (all)", euch: "you (all)" }),
  fam("Sie|pron", "Sie (Ihnen)", ["you (formal, polite)"], { sie: "you (formal)", ihnen: "(to) you (formal)" }, {
    capitalOnly: true,
  }),
  fam("sich|pron", "sich", ["oneself, himself, herself, themselves"], { sich: "oneself" }),
  fam("wer|pron", "wer (wen, wem)", ["who (wen: whom, wem: to whom)"], {
    wer: "who",
    wen: "whom",
    wem: "(to) whom",
    wessen: "whose",
  }),
  fam("was|pron", "was", ["what"], { was: "what" }),
  fam("man|pron", "man", ["one, you, people (in general)"], { man: "one, you" }),
];

export const FAMILY_BY_KEY = new Map(FUNCTION_FAMILIES.map((f) => [f.key, f]));

/** lowercase form -> family keys containing it */
export const FAMILY_FORMS: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const f of FUNCTION_FAMILIES) {
    for (const form of Object.keys(f.forms)) {
      const list = m.get(form) ?? [];
      list.push(f.key);
      m.set(form, list);
    }
  }
  return m;
})();

/**
 * Forms that are also ordinary content words; for these the analyzer looks up
 * the dictionary too and lets the context rules decide.
 * (sein = to be / his, meine = I mean / my, meinen = to mean / my)
 */
export const FAMILY_CONTENT_HOMOGRAPHS = new Set(["sein", "meine", "meinen", "meint"]);

/**
 * How the build script splits the frequency of an ambiguous form between
 * the words it can belong to.
 */
export const AMBIGUOUS_FORM_SHARES: Record<string, Record<string, number>> = {
  sein: { "sein|verb": 0.72, "sein|det": 0.28 },
  ihr: { "ihr|det": 0.45, "ihr|pron": 0.35, "sie|pron": 0.2 },
  sie: { "sie|pron": 0.75, "Sie|pron": 0.25 },
  ihnen: { "sie|pron": 0.7, "Sie|pron": 0.3 },
  meine: { "mein|det": 0.85, "meinen|verb": 0.15 },
  meinen: { "mein|det": 0.6, "meinen|verb": 0.4 },
};

/** Contractions of preposition + article. */
export const CONTRACTIONS: Record<string, [string, string]> = {
  im: ["in", "dem"],
  am: ["an", "dem"],
  zum: ["zu", "dem"],
  zur: ["zu", "der"],
  ins: ["in", "das"],
  beim: ["bei", "dem"],
  vom: ["von", "dem"],
  ans: ["an", "das"],
  aufs: ["auf", "das"],
  ums: ["um", "das"],
  durchs: ["durch", "das"],
  fürs: ["für", "das"],
  übers: ["über", "das"],
  unters: ["unter", "das"],
  vors: ["vor", "das"],
  hinters: ["hinter", "das"],
  hinterm: ["hinter", "dem"],
  überm: ["über", "dem"],
  unterm: ["unter", "dem"],
  vorm: ["vor", "dem"],
};

/** Short English glosses for contractions. */
export const CONTRACTION_GLOSS: Record<string, string> = {
  im: "in the",
  am: "at the, on the",
  zum: "to the",
  zur: "to the",
  ins: "into the",
  beim: "at the, while",
  vom: "from the",
  ans: "to the",
  aufs: "onto the",
  ums: "around the",
  durchs: "through the",
  fürs: "for the",
  übers: "over the, about the",
  unters: "under the",
  vors: "in front of the",
  hinters: "behind the",
  hinterm: "behind the",
  überm: "above the",
  unterm: "under the",
  vorm: "in front of the",
};
