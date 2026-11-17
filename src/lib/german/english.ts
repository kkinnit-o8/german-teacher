/**
 * Common English words. Used to pass English through unchanged in German
 * text, and by the game's "did the player write English?" heuristic.
 * Words that are also common German words (die, an, in, was, so, man, also,
 * hat, will, kind, rock, gift, bad, fast, hell, war, wand, see, rat, art...)
 * are deliberately left out.
 */
export const ENGLISH_WORDS = new Set(
  `the a of and to is are be been being am you your yours i me my mine he him his she her hers it its we us our they them their
this that these those there here what which who whom whose why how when where can could would should shall may might must
do does did done doing have has had having not no yes yeah okay ok please thank thanks sorry hello hi hey bye goodbye
want wants wanted like likes liked love loves need needs know knows think thinks get gets got go goes going went come comes
came see saw seen look looks make makes made take takes took give gives gave say says said tell tells told ask asks asked
pay pays paid buy buys bought order ordered help helps eat eats ate drink drinks drank coffee tea water beer wine juice
some any many much more most very too also just only really maybe because but or if then than with without for from about
into onto over under after before again always never often sometimes today tomorrow yesterday now later soon
good bad great nice fine cool sure right wrong big small little new old long short hot cold cheap expensive
one two three four five six seven eight nine ten hundred thousand first second last next
time day night week month year morning evening home house room table chair door window street city town train station
ticket platform card cash money price bill check menu food bread cake apple apples fruit allergy allergic
phone charger battery wifi password friend friends people man woman child children
please excuse me i'm you're it's don't can't won't isn't aren't wasn't didn't doesn't that's what's let's
`.split(/\s+/).filter(Boolean),
);
