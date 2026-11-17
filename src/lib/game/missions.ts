/**
 * City Adventures: 5 places, 2 missions each. Facts are fixed so the game
 * master can't invent prices, times or platforms.
 */

export interface Goal {
  id: string;
  text: string;
}

export interface Mission {
  id: string;
  placeId: string;
  title: string;
  brief: string;
  goals: Goal[];
  /** characters in the scene; the first one opens the scene */
  cast: string[];
  facts: string[];
  /** lemmas from the word bank the mission is about */
  keyWords: string[];
}

export interface Place {
  id: string;
  name: string;
  nameDe: string;
  description: string;
}

export const PLACES: Place[] = [
  { id: "cafe", name: "Café", nameDe: "das Café", description: "Coffee, cake and Lena behind the counter." },
  { id: "spaeti", name: "Späti", nameDe: "der Späti", description: "The corner shop that is open when everything else is closed." },
  { id: "restaurant", name: "Restaurant", nameDe: "das Restaurant", description: "Frau Becker’s restaurant, with Ben on his first day." },
  { id: "bahnhof", name: "Train station", nameDe: "der Bahnhof", description: "The ticket counter. Herr Schulze expects Sie." },
  { id: "markt", name: "Weekly market", nameDe: "der Wochenmarkt", description: "Oma Hilde’s fruit stall. Haggling welcome." },
];

export const MISSIONS: Mission[] = [
  {
    id: "cafe-coffee",
    placeId: "cafe",
    title: "Coffee for two",
    brief: "You and your friend Jonas are at the café. Order a coffee for yourself and an Apfelschorle for Jonas, and find out what it costs.",
    goals: [
      { id: "greet", text: "Greet Lena" },
      { id: "coffee", text: "Order a coffee for yourself" },
      { id: "jonas", text: "Order an Apfelschorle for Jonas" },
      { id: "price", text: "Ask what it costs" },
      { id: "pay", text: "Pay and say thank you" },
    ],
    cast: ["lena", "jonas"],
    facts: [
      "A coffee (Kaffee) costs 3,20 €. An Apfelschorle costs 2,80 €. Together: 6,00 €.",
      "Jonas can't decide at first (Cola? Tee?) and only then wants an Apfelschorle.",
      "Paying by card or cash is fine.",
    ],
    keyWords: ["Kaffee", "möchten", "bitte", "kosten", "zusammen", "bezahlen", "danke", "trinken"],
  },
  {
    id: "cafe-wifi",
    placeId: "cafe",
    title: "Cake and Wi-Fi",
    brief: "You want to work in the café for an hour. Get a piece of cake and the Wi-Fi password.",
    goals: [
      { id: "cake", text: "Order a piece of cake" },
      { id: "kind", text: "Choose which cake" },
      { id: "wifi", text: "Ask for the Wi-Fi password" },
      { id: "thanks", text: "Say thank you" },
    ],
    cast: ["lena"],
    facts: [
      "There is Apfelkuchen (3,50 €) and Käsekuchen (3,90 €). Lena recommends the Käsekuchen.",
      "The WLAN password is 'Milchschaum42'.",
      "The Wi-Fi is free for customers.",
    ],
    keyWords: ["Kuchen", "Stück", "Passwort", "WLAN", "empfehlen", "nehmen", "danke"],
  },
  {
    id: "spaeti-snack",
    placeId: "spaeti",
    title: "Midnight snack",
    brief: "It’s 23:45 and you’re hungry. Buy a snack at the Späti and find out whether you can pay by card.",
    goals: [
      { id: "greet", text: "Greet Herr Yilmaz" },
      { id: "snack", text: "Choose a snack" },
      { id: "card", text: "Ask if you can pay by card" },
      { id: "pay", text: "Pay" },
    ],
    cast: ["yilmaz"],
    facts: [
      "Chips cost 2,49 €, a bar of chocolate (Schokolade) 1,79 €, a Brezel 1,20 €.",
      "Card payment only from 10 €. Below that: cash only.",
      "There is a cash machine (Geldautomat) at the station, 5 minutes away.",
    ],
    keyWords: ["Karte", "bar", "zahlen", "Schokolade", "Hunger", "kosten", "nur"],
  },
  {
    id: "spaeti-charger",
    placeId: "spaeti",
    title: "Dead phone",
    brief: "Your phone is dead and you need to call a friend. Ask Herr Yilmaz to borrow a charger.",
    goals: [
      { id: "problem", text: "Explain that your phone is dead" },
      { id: "charger", text: "Ask to borrow a charger" },
      { id: "time", text: "Ask how long you can charge it" },
      { id: "thanks", text: "Thank him" },
    ],
    cast: ["yilmaz"],
    facts: [
      "Herr Yilmaz has a USB-C charging cable (Ladekabel) behind the counter.",
      "The socket (Steckdose) is next to the drinks fridge.",
      "You can charge for 15 minutes; it would be nice to buy a drink.",
    ],
    keyWords: ["Handy", "Akku", "leer", "Ladekabel", "leihen", "Minute", "aufladen"],
  },
  {
    id: "restaurant-allergy",
    placeId: "restaurant",
    title: "Dinner with an allergy",
    brief: "You are allergic to nuts. Order dinner and a drink, and make sure your food is safe.",
    goals: [
      { id: "menu", text: "Ask for the menu" },
      { id: "allergy", text: "Say that you are allergic to nuts" },
      { id: "safe", text: "Ask which dish is safe" },
      { id: "order", text: "Order a main dish" },
      { id: "drink", text: "Order a drink" },
    ],
    cast: ["ben", "becker"],
    facts: [
      "The pasta with pesto contains nuts. Ben first says it doesn't, then Frau Becker corrects him.",
      "Safe: Schnitzel with potato salad (14,50 €) and the tomato soup of the day (5,90 €).",
      "Drinks: water 2,50 €, apple juice 3,00 €, beer 3,80 €.",
    ],
    keyWords: ["Speisekarte", "Allergie", "Nuss", "bestellen", "Essen", "Getränk", "sicher"],
  },
  {
    id: "restaurant-table",
    placeId: "restaurant",
    title: "A table for two",
    brief: "Book a table for two people at eight o’clock tonight.",
    goals: [
      { id: "table", text: "Ask for a table" },
      { id: "people", text: "Say how many people" },
      { id: "time", text: "Say the time" },
      { id: "name", text: "Give your name" },
      { id: "confirm", text: "Confirm the booking" },
    ],
    cast: ["becker"],
    facts: [
      "At 20:00 only a table on the terrace (Terrasse) is free; inside there is a table at 20:30.",
      "The restaurant closes at 23:00.",
    ],
    keyWords: ["Tisch", "reservieren", "Person", "Uhr", "heute", "Abend", "Name"],
  },
  {
    id: "bahnhof-ticket",
    placeId: "bahnhof",
    title: "To Hamburg",
    brief: "Buy a return ticket to Hamburg and find out which platform your train leaves from. Herr Schulze expects Sie!",
    goals: [
      { id: "greet", text: "Greet Herr Schulze politely" },
      { id: "ticket", text: "Ask for a return ticket to Hamburg" },
      { id: "price", text: "Ask the price" },
      { id: "platform", text: "Ask which platform" },
      { id: "time", text: "Ask when the train leaves" },
    ],
    cast: ["schulze"],
    facts: [
      "The next ICE to Hamburg leaves at 14:12 from platform (Gleis) 7.",
      "A return ticket (Hin- und Rückfahrt), 2nd class, costs 89,90 €.",
      "The journey takes 1 hour 40 minutes.",
    ],
    keyWords: ["Fahrkarte", "Hamburg", "zurück", "Gleis", "Zug", "abfahren", "kosten"],
  },
  {
    id: "bahnhof-missed",
    placeId: "bahnhof",
    title: "Missed the train",
    brief: "You missed your train to Berlin. Find the next connection and ask whether your ticket is still valid. Use Sie!",
    goals: [
      { id: "problem", text: "Explain that you missed your train" },
      { id: "next", text: "Ask for the next connection" },
      { id: "valid", text: "Ask if your ticket is still valid" },
      { id: "platform", text: "Ask the platform" },
    ],
    cast: ["schulze"],
    facts: [
      "The next train to Berlin leaves at 15:05 from platform 3, with a change (umsteigen) in Hannover.",
      "Because your first train was late, your ticket is still valid.",
      "The train arrives in Berlin at 18:40.",
    ],
    keyWords: ["verpassen", "nächster", "Verbindung", "gültig", "umsteigen", "Gleis", "Verspätung"],
  },
  {
    id: "markt-apples",
    placeId: "markt",
    title: "A kilo of apples",
    brief: "Buy a kilo of apples from Oma Hilde, and try to get a better price.",
    goals: [
      { id: "greet", text: "Greet Oma Hilde" },
      { id: "apples", text: "Ask for apples" },
      { id: "price", text: "Ask the price" },
      { id: "haggle", text: "Haggle for a better price" },
      { id: "buy", text: "Buy one kilo" },
    ],
    cast: ["hilde"],
    facts: [
      "Apples cost 3,40 € per kilo. Hilde agrees to 3,00 € if you are friendly, or if you take two kilos for 6,00 €.",
      "She offers a piece to taste. The apples are from her own garden.",
    ],
    keyWords: ["Apfel", "Kilo", "kosten", "billig", "teuer", "Preis", "nehmen"],
  },
  {
    id: "markt-party",
    placeId: "markt",
    title: "Fruit for a party",
    brief: "You are having a party for ten people tomorrow. Buy fruit from Oma Hilde.",
    goals: [
      { id: "party", text: "Say you need fruit for a party of ten" },
      { id: "choose", text: "Choose at least two kinds of fruit" },
      { id: "amount", text: "Ask how much you need" },
      { id: "total", text: "Ask the total price" },
      { id: "pay", text: "Pay" },
    ],
    cast: ["hilde"],
    facts: [
      "Strawberries (Erdbeeren) 4,00 € per 500 g, bananas 2,00 € per kilo, grapes (Trauben) 3,50 € per kilo.",
      "Hilde recommends 1 kilo of strawberries and 2 kilos of grapes for ten people.",
      "She gives a free bunch of bananas for a party order.",
    ],
    keyWords: ["Obst", "Party", "Person", "Kilo", "zusammen", "brauchen", "Erdbeere"],
  },
];

export const MISSION_BY_ID = new Map(MISSIONS.map((m) => [m.id, m]));
export const PLACE_BY_ID = new Map(PLACES.map((p) => [p.id, p]));
