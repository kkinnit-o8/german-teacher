/**
 * City Adventures characters. Every look is built from the same parametric
 * parts (src/components/game/character.tsx).
 */

export type HairStyle = "ponytail" | "messy" | "neat" | "bun" | "curly" | "granny-bun";
export type EyeShape = "round" | "almond" | "narrow" | "droopy";
export type Outfit = "apron" | "hoodie" | "cardigan" | "vest" | "waiter" | "uniform" | "market";
export type Accessory = "hoops" | "beanie" | "mustache" | "stubble" | "pearls" | "bowtie" | "nametag" | "glasses" | "cap" | "round-glasses";

export interface Look {
  skin: string;
  hair: { style: HairStyle; color: string; shade: string };
  eyes: { shape: EyeShape; color: string };
  brows: string;
  outfit: { style: Outfit; main: string; accent: string; trim?: string };
  accessories: Accessory[];
  /** blush intensity 0..1 */
  blush: number;
  /** older characters get a few lines */
  age: "young" | "middle" | "old";
}

export interface Character {
  id: string;
  name: string;
  role: string;
  personality: string;
  /** expects to be addressed with Sie */
  expectsSie: boolean;
  /** text-to-speech: multipliers on the user's speed, and pitch */
  voice: { pitch: number; rate: number };
  look: Look;
}

export const EXPRESSIONS = ["neutral", "happy", "surprised", "confused", "annoyed", "thinking"] as const;
export type Expression = (typeof EXPRESSIONS)[number];

export const CHARACTERS: Character[] = [
  {
    id: "lena",
    name: "Lena",
    role: "barista at the café",
    personality: "cheerful, talks fast, loves recommending things, calls everyone du",
    expectsSie: false,
    voice: { pitch: 1.3, rate: 1.15 },
    look: {
      skin: "#f6cfb0",
      hair: { style: "ponytail", color: "#c8562a", shade: "#9a3b18" },
      eyes: { shape: "round", color: "#3f8f5a" },
      brows: "#9a3b18",
      outfit: { style: "apron", main: "#f3ece2", accent: "#7a4a2c", trim: "#d9b48a" },
      accessories: ["hoops"],
      blush: 0.7,
      age: "young",
    },
  },
  {
    id: "jonas",
    name: "Jonas",
    role: "your friend",
    personality: "friendly but very indecisive, changes his mind, says 'hmm, ich weiß nicht…' a lot",
    expectsSie: false,
    voice: { pitch: 0.95, rate: 0.95 },
    look: {
      skin: "#eab993",
      hair: { style: "messy", color: "#4a3426", shade: "#2f2017" },
      eyes: { shape: "almond", color: "#6b4a2b" },
      brows: "#2f2017",
      outfit: { style: "hoodie", main: "#4e8a6a", accent: "#e8e0c8" },
      accessories: ["beanie"],
      blush: 0.3,
      age: "young",
    },
  },
  {
    id: "yilmaz",
    name: "Herr Yilmaz",
    role: "works the night shift at the Späti (corner shop)",
    personality: "dry humour, calm, has seen everything at 3 a.m., kind underneath",
    expectsSie: true,
    voice: { pitch: 0.8, rate: 0.9 },
    look: {
      skin: "#c8916a",
      hair: { style: "neat", color: "#262626", shade: "#7d7d7d" },
      eyes: { shape: "narrow", color: "#3b2a1e" },
      brows: "#1d1d1d",
      outfit: { style: "cardigan", main: "#4a4f57", accent: "#d8d3c8" },
      accessories: ["mustache", "stubble"],
      blush: 0,
      age: "middle",
    },
  },
  {
    id: "becker",
    name: "Frau Becker",
    role: "owner of the restaurant",
    personality: "warm but very busy, efficient, proud of her kitchen",
    expectsSie: true,
    voice: { pitch: 1.05, rate: 1.05 },
    look: {
      skin: "#f2c6a2",
      hair: { style: "bun", color: "#a07c4c", shade: "#7a5a33" },
      eyes: { shape: "almond", color: "#3a6ea5" },
      brows: "#6b4f2c",
      outfit: { style: "vest", main: "#8c2f39", accent: "#222831" },
      accessories: ["pearls"],
      blush: 0.35,
      age: "middle",
    },
  },
  {
    id: "ben",
    name: "Ben",
    role: "waiter on his first day",
    personality: "nervous, eager to please, mixes up orders and apologises a lot",
    expectsSie: false,
    voice: { pitch: 1.12, rate: 1.1 },
    look: {
      skin: "#f7d5bb",
      hair: { style: "curly", color: "#e2b552", shade: "#b88a2c" },
      eyes: { shape: "round", color: "#3d7cc9" },
      brows: "#b88a2c",
      outfit: { style: "waiter", main: "#ffffff", accent: "#1f1f24" },
      accessories: ["bowtie", "nametag"],
      blush: 0.55,
      age: "young",
    },
  },
  {
    id: "schulze",
    name: "Herr Schulze",
    role: "ticket officer at the train station",
    personality: "strict, correct, follows the rules exactly, expects to be addressed with Sie",
    expectsSie: true,
    voice: { pitch: 0.75, rate: 0.85 },
    look: {
      skin: "#ebc3a3",
      hair: { style: "neat", color: "#a4a9ae", shade: "#7c8186" },
      eyes: { shape: "narrow", color: "#6c7a86" },
      brows: "#8a8f94",
      outfit: { style: "uniform", main: "#1f3a63", accent: "#c0392b", trim: "#e2c044" },
      accessories: ["glasses", "cap", "mustache"],
      blush: 0,
      age: "old",
    },
  },
  {
    id: "hilde",
    name: "Oma Hilde",
    role: "fruit seller at the weekly market",
    personality: "chatty, warm, calls customers 'Schätzchen', loves to haggle and to tell stories",
    expectsSie: true,
    voice: { pitch: 1.15, rate: 0.9 },
    look: {
      skin: "#f3d0b6",
      hair: { style: "granny-bun", color: "#f1eee8", shade: "#cfc9bf" },
      eyes: { shape: "droopy", color: "#6b4a2b" },
      brows: "#cfc9bf",
      outfit: { style: "market", main: "#5d8a4e", accent: "#f2e7d0", trim: "#c0473a" },
      accessories: ["round-glasses"],
      blush: 0.8,
      age: "old",
    },
  },
];

export const CHARACTER_BY_ID = new Map(CHARACTERS.map((c) => [c.id, c]));
