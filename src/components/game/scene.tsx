/**
 * Illustrated scenes: a back layer (walls, shelves), the characters, and a
 * front layer (counter, till, stall) so the characters stand behind it.
 */
import type { Character, Expression } from "@/lib/game/characters";
import { CharacterArt } from "./character";

export interface SceneActor {
  character: Character;
  expression: Expression;
  talking: boolean;
  /** the character who spoke last */
  active: boolean;
}

const W = 800;
const H = 450;

function CafeBack() {
  return (
    <g>
      <rect width={W} height={H} fill="#f2e2cc" />
      <rect y="330" width={W} height="120" fill="#c8a07a" />
      {/* window */}
      <rect x="40" y="60" width="200" height="190" rx="8" fill="#bfe3f2" stroke="#8a6a4a" strokeWidth="10" />
      <path d="M140 60 L140 250 M40 155 L240 155" stroke="#8a6a4a" strokeWidth="6" />
      <rect x="60" y="190" width="60" height="50" fill="#9cc79a" opacity="0.7" />
      <circle cx="200" cy="100" r="18" fill="#fff6c9" opacity="0.8" />
      {/* chalkboard menu */}
      <rect x="560" y="50" width="200" height="150" rx="6" fill="#2f3b33" stroke="#8a6a4a" strokeWidth="8" />
      <text x="660" y="82" fill="#f5f0e6" fontSize="20" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic">
        Karte
      </text>
      {[
        ["Kaffee", "3,20"],
        ["Apfelschorle", "2,80"],
        ["Apfelkuchen", "3,50"],
        ["Käsekuchen", "3,90"],
      ].map(([a, b], i) => (
        <g key={a} fontSize="14" fontFamily="sans-serif" fill="#e8e2d4">
          <text x="578" y={110 + i * 22}>{a}</text>
          <text x="742" y={110 + i * 22} textAnchor="end">
            {b}
          </text>
        </g>
      ))}
      {/* shelf with cups */}
      <rect x="300" y="120" width="200" height="8" fill="#8a6a4a" />
      {[320, 360, 400, 440, 470].map((x, i) => (
        <path key={x} d={`M${x} 120 l4 -22 h${i % 2 ? 22 : 18} l4 22 z`} fill={i % 2 ? "#e9a46b" : "#fdfaf4"} stroke="#c9b8a0" />
      ))}
      {/* pendant lamps */}
      {[330, 470].map((x) => (
        <g key={x}>
          <path d={`M${x} 0 L${x} 30`} stroke="#555" strokeWidth="2" />
          <path d={`M${x - 22} 50 Q${x} 18 ${x + 22} 50 Z`} fill="#3f6f5a" />
          <ellipse cx={x} cy="52" rx="10" ry="4" fill="#fff3b0" />
        </g>
      ))}
    </g>
  );
}

function CafeFront() {
  return (
    <g>
      <rect x="0" y="318" width={W} height="14" fill="#7a5233" />
      <rect x="0" y="330" width={W} height="120" fill="#9a6a44" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={i} x={i * 100 + 6} y="342" width="88" height="96" rx="4" fill="#8a5d3b" />
      ))}
      {/* espresso machine */}
      <rect x="60" y="250" width="120" height="70" rx="8" fill="#c9ccd1" stroke="#8d9299" strokeWidth="3" />
      <rect x="76" y="262" width="88" height="20" rx="4" fill="#3b3f46" />
      <circle cx="96" cy="272" r="5" fill="#e74c3c" />
      <path d="M100 290 l0 14 M140 290 l0 14" stroke="#555" strokeWidth="5" />
      <path d="M92 304 h18 v12 h-18 z M132 304 h18 v12 h-18 z" fill="#fdfaf4" />
      {/* cake display */}
      <rect x="600" y="262" width="160" height="58" rx="10" fill="rgba(220,240,255,0.55)" stroke="#9fb8c8" strokeWidth="3" />
      <path d="M620 312 l30 -30 l30 30 z" fill="#f4d58d" />
      <path d="M620 312 l30 -30 l30 30" stroke="#c98c3e" strokeWidth="3" fill="none" />
      <path d="M690 312 l30 -26 l26 26 z" fill="#fff4dc" stroke="#e7c992" strokeWidth="2" />
    </g>
  );
}

function SpaetiBack() {
  return (
    <g>
      <rect width={W} height={H} fill="#272c3d" />
      <rect y="330" width={W} height="120" fill="#3a3f4f" />
      {/* drinks fridge */}
      <rect x="30" y="60" width="180" height="270" rx="6" fill="#d9f3ff" stroke="#9fb0c0" strokeWidth="6" />
      {[0, 1, 2, 3].map((r) =>
        [0, 1, 2, 3, 4].map((c) => (
          <rect
            key={`${r}${c}`}
            x={46 + c * 32}
            y={80 + r * 60}
            width="20"
            height="44"
            rx="6"
            fill={["#e74c3c", "#27ae60", "#f39c12", "#2980b9", "#8e44ad"][(r + c) % 5]}
          />
        )),
      )}
      {/* neon sign */}
      <text x="400" y="80" fill="#ff6ad5" fontSize="44" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif" style={{ filter: "drop-shadow(0 0 8px #ff6ad5)" }}>
        SPÄTI
      </text>
      <text x="400" y="106" fill="#7ef0ff" fontSize="14" textAnchor="middle" fontFamily="sans-serif">
        24/7 · Getränke · Snacks
      </text>
      {/* snack shelves */}
      {[150, 210, 270].map((y, r) => (
        <g key={y}>
          <rect x="560" y={y} width="210" height="6" fill="#8b8f9c" />
          {[0, 1, 2, 3, 4, 5].map((c) => (
            <rect key={c} x={566 + c * 34} y={y - 36} width="28" height="36" rx="3" fill={["#f1c40f", "#e67e22", "#16a085", "#c0392b", "#9b59b6", "#3498db"][(c + r) % 6]} />
          ))}
        </g>
      ))}
      {/* clock */}
      <rect x="350" y="130" width="100" height="40" rx="6" fill="#111" />
      <text x="400" y="158" fill="#ff4d4d" fontSize="24" textAnchor="middle" fontFamily="monospace">
        23:45
      </text>
    </g>
  );
}

function SpaetiFront() {
  return (
    <g>
      <rect x="0" y="318" width={W} height="132" fill="#4b4f5c" />
      <rect x="0" y="318" width={W} height="10" fill="#6b7080" />
      {/* till */}
      <rect x="540" y="262" width="110" height="60" rx="6" fill="#d0d3d8" stroke="#8d9299" strokeWidth="3" />
      <rect x="556" y="270" width="78" height="20" rx="3" fill="#163d2a" />
      <text x="595" y="285" fill="#7dffb2" fontSize="12" textAnchor="middle" fontFamily="monospace">
        2,49 €
      </text>
      {/* candy rack */}
      <rect x="150" y="270" width="140" height="52" rx="4" fill="#5a5f6e" />
      {[0, 1, 2, 3, 4, 5].map((c) => (
        <rect key={c} x={156 + c * 22} y="276" width="16" height="40" rx="2" fill={["#e74c3c", "#f1c40f", "#2ecc71", "#3498db", "#e67e22", "#9b59b6"][c]} />
      ))}
    </g>
  );
}

function RestaurantBack() {
  return (
    <g>
      <rect width={W} height={H} fill="#5e2c2c" />
      <rect y="0" width={W} height="200" fill="#6e3434" />
      <rect y="330" width={W} height="120" fill="#4a2a1e" />
      {[90, 640].map((x) => (
        <g key={x}>
          <rect x={x} y="70" width="110" height="80" rx="4" fill="#d9c08a" />
          <rect x={x + 8} y="78" width="94" height="64" fill={x < 400 ? "#7fa36b" : "#6c8fb3"} />
          <circle cx={x + 70} cy="100" r="12" fill="#f4e3a1" />
        </g>
      ))}
      {/* wine rack */}
      <rect x="300" y="60" width="200" height="150" rx="4" fill="#3d2018" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3, 4].map((c) => <circle key={`${r}${c}`} cx={330 + c * 35} cy={90 + r * 45} r="13" fill={(r + c) % 3 ? "#5a1a2a" : "#2f4a2a"} stroke="#1d0f0b" strokeWidth="2" />),
      )}
      {/* lamps */}
      {[200, 600].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="230" rx="60" ry="30" fill="#ffd27a" opacity="0.15" />
          <path d={`M${x - 14} 210 L${x + 14} 210 L${x + 8} 236 L${x - 8} 236 Z`} fill="#f2c26b" />
        </g>
      ))}
      {/* plant */}
      <path d="M40 330 C30 260 60 230 70 200 C76 240 96 260 90 330 Z" fill="#2f6b3a" />
    </g>
  );
}

function RestaurantFront() {
  return (
    <g>
      <path d="M120 312 L680 312 L700 450 L100 450 Z" fill="#f7f1e6" />
      <path d="M120 312 L680 312 L684 330 L116 330 Z" fill="#e7dccb" />
      {[180, 280, 380, 480, 580].map((x) => (
        <path key={x} d={`M${x} 330 L${x - 10} 450`} stroke="#eadfcd" strokeWidth="3" />
      ))}
      {/* candle and menu */}
      <rect x="388" y="282" width="16" height="32" rx="3" fill="#fdfaf0" />
      <path d="M396 270 q6 8 0 14 q-6 -6 0 -14" fill="#ffb636" />
      <rect x="470" y="300" width="70" height="12" rx="2" fill="#8c2f39" />
      <circle cx="300" cy="306" r="14" fill="#fff" stroke="#ddd" strokeWidth="2" />
    </g>
  );
}

function BahnhofBack() {
  return (
    <g>
      <rect width={W} height={H} fill="#cfd8df" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <path key={i} d={`M${i * 100} 0 L${i * 100} ${H}`} stroke="#b9c4cc" strokeWidth="2" />
      ))}
      {/* departure board */}
      <rect x="40" y="40" width="300" height="130" rx="6" fill="#0f2240" />
      <text x="56" y="70" fill="#9fb7d9" fontSize="13" fontFamily="sans-serif">
        Abfahrt
      </text>
      {[
        ["14:12", "ICE  Hamburg", "7"],
        ["15:05", "IC   Berlin", "3"],
        ["15:20", "RE   Hannover", "5"],
      ].map(([t, d, g], i) => (
        <g key={t} fontFamily="monospace" fontSize="16" fill="#ffd34d">
          <text x="56" y={98 + i * 26}>{t}</text>
          <text x="120" y={98 + i * 26} fill="#ffffff">
            {d}
          </text>
          <text x="318" y={98 + i * 26} textAnchor="end">
            {g}
          </text>
        </g>
      ))}
      {/* clock */}
      <circle cx="680" cy="100" r="54" fill="#fff" stroke="#2c3e50" strokeWidth="8" />
      <path d="M680 100 L680 62 M680 100 L708 110" stroke="#111" strokeWidth="5" strokeLinecap="round" />
      <circle cx="680" cy="100" r="4" fill="#c0392b" />
      {/* ticket office window */}
      <rect x="230" y="190" width="340" height="140" rx="6" fill="#e9eef2" stroke="#7f8c96" strokeWidth="6" />
      {/* sign, beside the window so the officer doesn't hide it */}
      <rect x="600" y="176" width="170" height="40" rx="6" fill="#1f3a63" />
      <text x="685" y="203" fill="#ffffff" fontSize="20" textAnchor="middle" fontFamily="sans-serif" fontWeight="bold">
        Fahrkarten
      </text>
      <rect y="330" width={W} height="120" fill="#9aa6af" />
    </g>
  );
}

function BahnhofFront() {
  return (
    <g>
      {/* glass partition with talk hole */}
      <rect x="236" y="222" width="328" height="100" fill="rgba(200,230,250,0.28)" stroke="#9fb3c2" strokeWidth="3" />
      <circle cx="400" cy="280" r="14" fill="none" stroke="#9fb3c2" strokeWidth="2" strokeDasharray="3 3" />
      <rect x="0" y="318" width={W} height="132" fill="#6c7a86" />
      <rect x="200" y="314" width="400" height="12" rx="3" fill="#4d5a65" />
      <rect x="340" y="318" width="120" height="10" fill="#2b3640" />
    </g>
  );
}

function MarktBack() {
  return (
    <g>
      <rect width={W} height={H} fill="#bfe2f5" />
      <circle cx="680" cy="70" r="36" fill="#fff3b0" />
      {/* houses */}
      {[
        [0, 140, "#e7b38f"],
        [120, 110, "#d98b7a"],
        [250, 150, "#f0d39a"],
        [520, 120, "#a9c1d9"],
        [640, 150, "#e7b38f"],
      ].map(([x, y, c]) => (
        <g key={String(x)}>
          <rect x={Number(x)} y={Number(y)} width="140" height={330 - Number(y)} fill={String(c)} />
          <path d={`M${Number(x) - 6} ${Number(y)} L${Number(x) + 70} ${Number(y) - 50} L${Number(x) + 146} ${Number(y)} Z`} fill="#9b4b3b" />
          {[0, 1].map((r) => [0, 1, 2].map((k) => <rect key={`${r}${k}`} x={Number(x) + 18 + k * 40} y={Number(y) + 20 + r * 50} width="24" height="30" fill="#fdf6e3" stroke="#6b5040" strokeWidth="2" />))}
        </g>
      ))}
      <rect y="330" width={W} height="120" fill="#b9a68f" />
      {/* awning */}
      <rect x="120" y="150" width="560" height="10" fill="#7a5233" />
      {Array.from({ length: 14 }).map((_, i) => (
        <path key={i} d={`M${120 + i * 40} 160 L${160 + i * 40} 160 L${160 + i * 40} 196 Q${140 + i * 40} 210 ${120 + i * 40} 196 Z`} fill={i % 2 ? "#ffffff" : "#c0473a"} />
      ))}
      <rect x="126" y="160" width="10" height="170" fill="#7a5233" />
      <rect x="664" y="160" width="10" height="170" fill="#7a5233" />
    </g>
  );
}

function MarktFront() {
  const crate = (x: number, color: string, round: boolean) => (
    <g key={x}>
      <rect x={x} y="290" width="120" height="40" fill="#b07a45" stroke="#7a5233" strokeWidth="3" />
      {Array.from({ length: 6 }).map((_, i) =>
        round ? (
          <circle key={i} cx={x + 14 + i * 18} cy={286 - (i % 2) * 6} r="11" fill={color} stroke="rgba(0,0,0,0.15)" />
        ) : (
          <path key={i} d={`M${x + 6 + i * 18} 290 q10 -26 22 -4`} stroke={color} strokeWidth="9" fill="none" strokeLinecap="round" />
        ),
      )}
    </g>
  );
  return (
    <g>
      <rect x="100" y="320" width="600" height="130" fill="#8a5d3b" />
      <rect x="100" y="318" width="600" height="12" fill="#6e4a2e" />
      {crate(120, "#d63c32", true)}
      {crate(250, "#f2d13c", false)}
      {crate(380, "#7e3f8f", true)}
      {crate(510, "#e8343f", true)}
      <rect x="640" y="268" width="56" height="34" rx="3" fill="#fdfaf0" stroke="#7a5233" strokeWidth="2" transform="rotate(-6 668 285)" />
      <text x="668" y="291" fontSize="12" textAnchor="middle" fontFamily="sans-serif" fill="#333" transform="rotate(-6 668 285)">
        3,40 €/kg
      </text>
    </g>
  );
}

const LAYERS: Record<string, [() => React.ReactElement, () => React.ReactElement]> = {
  cafe: [CafeBack, CafeFront],
  spaeti: [SpaetiBack, SpaetiFront],
  restaurant: [RestaurantBack, RestaurantFront],
  bahnhof: [BahnhofBack, BahnhofFront],
  markt: [MarktBack, MarktFront],
};

/** Where characters stand (centre x in %), depending on how many there are. */
const SLOTS: Record<number, number[]> = { 1: [50], 2: [34, 66], 3: [25, 50, 75] };
/** Per-place positions where the defaults would hide something (the café's menu board). */
const PLACE_SLOTS: Record<string, Record<number, number[]>> = { cafe: { 2: [33, 58] } };

export function SceneView({ placeId, actors, className = "" }: { placeId: string; actors: SceneActor[]; className?: string }) {
  const [Back, Front] = LAYERS[placeId] ?? LAYERS.cafe;
  const slots = PLACE_SLOTS[placeId]?.[actors.length] ?? SLOTS[actors.length] ?? SLOTS[3];
  return (
    <div className={`relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-border ${className}`} data-testid="scene">
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="xMidYMid slice">
        <Back />
      </svg>
      {actors.map((a, i) => (
        <div
          key={a.character.id}
          className={`absolute transition-[filter,transform] duration-300 ${a.active ? "gt-speaking-glow" : "opacity-95"}`}
          style={{ left: `${slots[i]}%`, bottom: "12%", height: "86%", transform: `translateX(-50%) ${a.active ? "scale(1.02)" : ""}` }}
          data-testid={`actor-${a.character.id}`}
          data-expression={a.expression}
        >
          <CharacterArt character={a.character} expression={a.expression} talking={a.talking} className="h-full w-auto" />
        </div>
      ))}
      <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="xMidYMid slice">
        <Front />
      </svg>
    </div>
  );
}

export function SceneThumb({ placeId, actors }: { placeId: string; actors: SceneActor[] }) {
  return <SceneView placeId={placeId} actors={actors} />;
}
