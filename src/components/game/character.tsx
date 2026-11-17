/**
 * Anime-style characters drawn from one parametric SVG system: hair styles,
 * eye shapes, outfits and accessories come from the character's Look.
 * Six expressions, blinking, breathing, and a mouth that moves while talking.
 * Animations are CSS (see globals.css) and stop with prefers-reduced-motion.
 */
import type { Character, Expression, Look } from "@/lib/game/characters";

const EYE_L = { x: 98, y: 152 };
const EYE_R = { x: 142, y: 152 };

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/* ------------------------------ hair ------------------------------ */

function HairBack({ look }: { look: Look }) {
  const { style, color, shade: dark } = look.hair;
  if (style === "ponytail")
    return (
      <g>
        <path d="M168 112 C210 120 214 200 190 250 C182 268 168 270 172 248 C186 200 180 150 160 128 Z" fill={color} />
        <path d="M176 140 C196 170 194 210 182 240" stroke={dark} strokeWidth="3" fill="none" opacity="0.5" />
        <circle cx="168" cy="118" r="9" fill={look.outfit.trim ?? "#e0b84f"} />
      </g>
    );
  if (style === "curly")
    return (
      <g fill={dark}>
        {[
          [64, 140],
          [176, 140],
          [70, 172],
          [170, 172],
        ].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r="16" />
        ))}
      </g>
    );
  if (style === "bun" || style === "granny-bun")
    return (
      <g>
        <circle cx="120" cy={style === "bun" ? 86 : 90} r={style === "bun" ? 25 : 22} fill={color} stroke={dark} strokeWidth="2" />
        <path d={`M104 ${style === "bun" ? 84 : 88} Q120 ${style === "bun" ? 70 : 76} 136 ${style === "bun" ? 84 : 88}`} stroke={dark} strokeWidth="2" fill="none" opacity="0.6" />
      </g>
    );
  return null;
}

function HairFront({ look }: { look: Look }) {
  const { style, color, shade: dark } = look.hair;
  switch (style) {
    case "ponytail":
      return (
        <g>
          <path d="M60 140 C52 70 188 64 180 140 C176 118 160 100 142 96 C150 110 146 122 138 128 C126 106 104 100 88 108 C86 122 74 128 66 146 Z" fill={color} />
          <path d="M120 84 C108 96 102 108 98 120" stroke={dark} strokeWidth="2.5" fill="none" opacity="0.6" />
        </g>
      );
    case "messy":
      return (
        <path
          d="M60 142 C48 92 76 66 104 70 L112 56 L122 70 L136 58 L142 74 C170 72 190 98 180 142 C176 124 168 114 156 108 L150 122 L138 108 L126 124 L114 108 L100 122 L94 108 C80 112 70 124 64 146 Z"
          fill={color}
        />
      );
    case "neat":
      return (
        <g>
          <path d="M62 138 C56 78 184 74 178 138 C174 120 168 108 158 102 C140 98 112 96 96 104 C80 110 70 122 66 140 Z" fill={color} />
          <path d="M96 104 C110 96 130 92 150 98" stroke={dark} strokeWidth="2.5" fill="none" />
          {/* grey temples */}
          <path d="M62 138 C62 126 64 118 68 112 L72 132 Z" fill={dark} />
          <path d="M178 138 C178 126 176 118 172 112 L168 132 Z" fill={dark} />
        </g>
      );
    case "bun":
      return (
        <g>
          <path d="M62 140 C56 82 184 78 178 140 C172 116 150 100 120 100 C92 100 70 114 62 140 Z" fill={color} />
          <path d="M120 100 C112 112 96 120 84 124" stroke={dark} strokeWidth="2" fill="none" opacity="0.6" />
          <path d="M120 100 C130 112 148 118 160 122" stroke={dark} strokeWidth="2" fill="none" opacity="0.6" />
        </g>
      );
    case "curly":
      return (
        <g fill={color}>
          {[
            [76, 112],
            [96, 94],
            [120, 88],
            [144, 94],
            [164, 112],
            [66, 132],
            [174, 132],
            [108, 106],
            [134, 106],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i > 6 ? 13 : 17} />
          ))}
        </g>
      );
    case "granny-bun":
      return (
        <g>
          <path d="M60 144 C54 84 186 80 180 144 C176 120 156 104 120 104 C86 104 66 120 60 144 Z" fill={color} />
          {[
            [78, 116],
            [100, 104],
            [140, 104],
            [162, 116],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="9" fill={color} stroke={dark} strokeWidth="1.5" />
          ))}
        </g>
      );
  }
}

/* ------------------------------ face ------------------------------ */

function Eye({ cx, cy, look, expression, side }: { cx: number; cy: number; look: Look; expression: Expression; side: -1 | 1 }) {
  const shape = look.eyes.shape;
  const ry = shape === "round" ? 15 : shape === "almond" ? 12 : shape === "narrow" ? 8 : 11;
  const rx = shape === "narrow" ? 13 : 12;
  if (expression === "happy") {
    // closed happy eyes ^ ^
    return <path d={`M${cx - 12} ${cy + 3} Q${cx} ${cy - 11} ${cx + 12} ${cy + 3}`} stroke="#2b2230" strokeWidth="3.5" fill="none" strokeLinecap="round" />;
  }
  const wide = expression === "surprised";
  const pr = wide ? 5 : 8; // iris
  const look_x = expression === "thinking" ? 4 * side * 0 + 4 : 0;
  const look_y = expression === "thinking" ? -5 : 0;
  const ery = wide ? ry + 3 : ry;
  return (
    <g className="gt-eye" style={{ transformOrigin: `${cx}px ${cy}px` }}>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ery} fill="#fff" stroke="#2b2230" strokeWidth="1.5" />
      <ellipse cx={cx + look_x} cy={cy + 2 + look_y} rx={pr + 2} ry={Math.min(ery - 2, pr + 4)} fill={look.eyes.color} />
      <ellipse cx={cx + look_x} cy={cy + 3 + look_y} rx={pr - 2} ry={Math.min(ery - 5, pr)} fill="#1c1622" />
      <circle cx={cx + look_x - 3} cy={cy - 2 + look_y} r="3.2" fill="#fff" />
      <circle cx={cx + look_x + 3} cy={cy + 6 + look_y} r="1.4" fill="#fff" opacity="0.8" />
      {/* upper lash line */}
      <path
        d={`M${cx - rx - 1} ${cy - 1} Q${cx} ${cy - ery - 5} ${cx + rx + 1} ${cy - 1}`}
        stroke="#2b2230"
        strokeWidth={shape === "narrow" ? 3 : 3.5}
        fill="none"
        strokeLinecap="round"
      />
      {shape === "droopy" && <path d={`M${cx - rx} ${cy + ery - 2} Q${cx} ${cy + ery + 3} ${cx + rx} ${cy + ery - 2}`} stroke="#b48b77" strokeWidth="1.5" fill="none" />}
      {expression === "annoyed" && (
        // half-closed lid
        <path d={`M${cx - rx - 1} ${cy - ery} L${cx + rx + 1} ${cy - ery} L${cx + rx + 1} ${cy - 2} Q${cx} ${cy + 2} ${cx - rx - 1} ${cy - 2} Z`} fill={look.skin} stroke="#2b2230" strokeWidth="2.5" />
      )}
    </g>
  );
}

function Brows({ look, expression }: { look: Look; expression: Expression }) {
  const c = look.brows;
  const y = EYE_L.y - 24;
  const shapes: Record<Expression, [string, string]> = {
    neutral: [`M84 ${y + 2} Q98 ${y - 4} 112 ${y + 1}`, `M128 ${y + 1} Q142 ${y - 4} 156 ${y + 2}`],
    happy: [`M84 ${y} Q98 ${y - 8} 112 ${y - 2}`, `M128 ${y - 2} Q142 ${y - 8} 156 ${y}`],
    surprised: [`M84 ${y - 6} Q98 ${y - 14} 112 ${y - 7}`, `M128 ${y - 7} Q142 ${y - 14} 156 ${y - 6}`],
    confused: [`M84 ${y - 6} Q98 ${y - 12} 112 ${y - 4}`, `M128 ${y + 4} Q142 ${y + 1} 156 ${y + 3}`],
    annoyed: [`M84 ${y - 2} L112 ${y + 6}`, `M128 ${y + 6} L156 ${y - 2}`],
    thinking: [`M84 ${y + 2} Q98 ${y} 112 ${y + 2}`, `M128 ${y - 4} Q142 ${y - 12} 156 ${y - 6}`],
  };
  const [l, r] = shapes[expression];
  const w = look.age === "old" ? 5 : 4;
  return (
    <g stroke={c} strokeWidth={w} strokeLinecap="round" fill="none">
      <path d={l} />
      <path d={r} />
    </g>
  );
}

function Mouth({ expression, talking }: { expression: Expression; talking: boolean }) {
  const y = 186;
  const closed: Record<Expression, React.ReactNode> = {
    neutral: <path d={`M112 ${y} Q120 ${y + 5} 128 ${y}`} stroke="#7a2e3a" strokeWidth="3" fill="none" strokeLinecap="round" />,
    happy: <path d={`M106 ${y - 3} Q120 ${y + 14} 134 ${y - 3} Z`} fill="#9c3b4a" stroke="#7a2e3a" strokeWidth="2" strokeLinejoin="round" />,
    surprised: <ellipse cx="120" cy={y + 2} rx="6" ry="8" fill="#9c3b4a" stroke="#7a2e3a" strokeWidth="2" />,
    confused: <path d={`M108 ${y + 2} Q114 ${y - 3} 120 ${y + 2} Q126 ${y + 6} 132 ${y}`} stroke="#7a2e3a" strokeWidth="3" fill="none" strokeLinecap="round" />,
    annoyed: <path d={`M110 ${y + 4} Q120 ${y - 1} 130 ${y + 4}`} stroke="#7a2e3a" strokeWidth="3" fill="none" strokeLinecap="round" />,
    thinking: <path d={`M114 ${y + 1} L128 ${y - 1}`} stroke="#7a2e3a" strokeWidth="3" fill="none" strokeLinecap="round" />,
  };
  if (!talking) return <g>{closed[expression]}</g>;
  return (
    <g>
      <g className="gt-mouth-closed">{closed[expression]}</g>
      <g className="gt-mouth-open">
        <path d={`M109 ${y - 2} Q120 ${y - 4} 131 ${y - 2} Q128 ${y + 12} 120 ${y + 12} Q112 ${y + 12} 109 ${y - 2} Z`} fill="#8a2f3e" stroke="#7a2e3a" strokeWidth="2" />
        <path d={`M113 ${y + 7} Q120 ${y + 4} 127 ${y + 7}`} fill="#e2747f" />
      </g>
    </g>
  );
}

/* ------------------------------ outfit ------------------------------ */

function Outfit({ look }: { look: Look }) {
  const { style, main, accent, trim } = look.outfit;
  const body = "M36 330 C36 266 70 238 120 234 C170 238 204 266 204 330 Z";
  const collar = (fill: string) => <path d="M98 236 L120 262 L142 236 C134 232 106 232 98 236 Z" fill={fill} />;
  switch (style) {
    case "apron":
      return (
        <g>
          <path d={body} fill={main} />
          {[250, 266, 282, 298, 314].map((y) => (
            <path key={y} d={`M44 ${y} L196 ${y}`} stroke={trim ?? "#ccc"} strokeWidth="3" opacity="0.5" />
          ))}
          <path d="M84 256 L156 256 L162 330 L78 330 Z" fill={accent} />
          <path d="M84 256 L98 238 M156 256 L142 238" stroke={accent} strokeWidth="5" />
          <circle cx="120" cy="290" r="11" fill="none" stroke={trim ?? "#e5c9a0"} strokeWidth="2.5" />
          <path d="M115 288 q5 -8 10 0" stroke={trim ?? "#e5c9a0"} strokeWidth="2" fill="none" />
        </g>
      );
    case "hoodie":
      return (
        <g>
          <path d={body} fill={main} />
          <path d="M86 238 C92 262 148 262 154 238 C146 234 94 234 86 238 Z" fill={shade(main, -25)} />
          <path d="M108 256 L106 290 M132 256 L134 290" stroke={accent} strokeWidth="3" strokeLinecap="round" />
          <path d="M84 300 L156 300 L150 324 L90 324 Z" fill={shade(main, -15)} />
        </g>
      );
    case "cardigan":
      return (
        <g>
          <path d={body} fill={main} />
          <path d="M104 236 L120 330 L136 236 Z" fill={accent} />
          {collar(shade(accent, -20))}
          {[270, 292, 314].map((y) => (
            <circle key={y} cx="140" cy={y} r="3.5" fill={shade(main, 40)} />
          ))}
        </g>
      );
    case "vest":
      return (
        <g>
          <path d={body} fill={main} />
          {collar("#f4f4f4")}
          <path d="M72 252 C88 246 104 250 112 262 L112 330 L58 330 C58 290 62 266 72 252 Z" fill={accent} />
          <path d="M168 252 C152 246 136 250 128 262 L128 330 L182 330 C182 290 178 266 168 252 Z" fill={accent} />
        </g>
      );
    case "waiter":
      return (
        <g>
          <path d={body} fill={main} />
          <path d="M70 254 C90 248 106 254 112 266 L112 330 L58 330 C58 292 62 268 70 254 Z" fill={accent} />
          <path d="M170 254 C150 248 134 254 128 266 L128 330 L182 330 C182 292 178 268 170 254 Z" fill={accent} />
          {collar("#ffffff")}
        </g>
      );
    case "uniform":
      return (
        <g>
          <path d={body} fill={main} />
          <path d="M98 236 L120 262 L142 236 Z" fill="#f2f2f2" />
          <path d="M116 246 L124 246 L128 300 L120 310 L112 300 Z" fill={accent} />
          <path d="M70 252 L100 300 M170 252 L140 300" stroke={shade(main, -25)} strokeWidth="4" />
          {[284, 306].map((y) => (
            <circle key={y} cx="150" cy={y} r="3.5" fill={trim ?? "#e2c044"} />
          ))}
          <rect x="62" y="250" width="22" height="7" rx="2" fill={trim ?? "#e2c044"} transform="rotate(-18 73 253)" />
        </g>
      );
    case "market":
      return (
        <g>
          <path d={body} fill={main} />
          {collar(accent)}
          <path d="M82 262 L158 262 L166 330 L74 330 Z" fill={accent} />
          {[270, 286, 302, 318].map((y) => (
            <path key={y} d={`M80 ${y} L160 ${y}`} stroke={trim ?? "#c0473a"} strokeWidth="4" opacity="0.8" />
          ))}
        </g>
      );
  }
}

/* ------------------------------ accessories ------------------------------ */

function Accessories({ look, front }: { look: Look; front: boolean }) {
  const a = new Set(look.accessories);
  if (!front) return null;
  return (
    <g>
      {a.has("stubble") && <path d="M86 178 C92 206 110 214 120 214 C130 214 148 206 154 178 C146 196 132 204 120 204 C108 204 94 196 86 178 Z" fill="#2b2b2b" opacity="0.18" />}
      {a.has("mustache") && (
        <path
          d="M104 178 C110 172 116 174 120 178 C124 174 130 172 136 178 C132 184 124 182 120 180 C116 182 108 184 104 178 Z"
          fill={look.hair.style === "neat" && look.age === "old" ? "#8f9499" : "#262626"}
        />
      )}
      {a.has("hoops") && (
        <g fill="none" stroke="#e2b552" strokeWidth="2.5">
          <circle cx="62" cy="170" r="7" />
          <circle cx="178" cy="170" r="7" />
        </g>
      )}
      {a.has("pearls") && (
        <g fill="#f7f3ea" stroke="#d8cfbd" strokeWidth="1">
          <circle cx="62" cy="168" r="4.5" />
          <circle cx="178" cy="168" r="4.5" />
        </g>
      )}
      {a.has("glasses") && (
        <g fill="none" stroke="#33383d" strokeWidth="3">
          <rect x="80" y="140" width="34" height="24" rx="5" />
          <rect x="126" y="140" width="34" height="24" rx="5" />
          <path d="M114 150 L126 150" />
        </g>
      )}
      {a.has("round-glasses") && (
        <g fill="rgba(255,255,255,0.15)" stroke="#8a5a3c" strokeWidth="2.5">
          <circle cx="98" cy="156" r="16" />
          <circle cx="142" cy="156" r="16" />
          <path d="M114 154 L126 154" fill="none" />
        </g>
      )}
      {a.has("beanie") && (
        <g>
          <path d="M58 122 C56 64 184 64 182 122 Z" fill="#d9a441" />
          <rect x="54" y="110" width="132" height="18" rx="9" fill="#c28f2e" />
          {[70, 86, 102, 118, 134, 150, 166].map((x) => (
            <path key={x} d={`M${x} 112 L${x} 126`} stroke="#a87a22" strokeWidth="2" />
          ))}
        </g>
      )}
      {a.has("cap") && (
        <g>
          <path d="M64 112 C64 70 176 70 176 112 Z" fill={look.outfit.main} />
          <path d="M58 114 L182 114 L186 126 L54 126 Z" fill={shade(look.outfit.main, -25)} />
          <path d="M60 126 Q120 140 180 126" stroke="#111" strokeWidth="5" fill="none" />
          <circle cx="120" cy="96" r="8" fill={look.outfit.trim ?? "#e2c044"} />
        </g>
      )}
      {a.has("bowtie") && <path d="M106 248 L118 254 L106 260 Z M134 248 L122 254 L134 260 Z" fill="#c0392b" />}
      {a.has("nametag") && (
        <g>
          <rect x="140" y="276" width="34" height="16" rx="3" fill="#fff" stroke="#aaa" />
          <text x="157" y="288" fontSize="9" textAnchor="middle" fill="#333" fontFamily="sans-serif" fontWeight="bold">
            BEN
          </text>
        </g>
      )}
    </g>
  );
}

/* ------------------------------ the character ------------------------------ */

export function CharacterArt({
  character,
  expression = "neutral",
  talking = false,
  className = "",
  title,
}: {
  character: Character;
  expression?: Expression;
  talking?: boolean;
  className?: string;
  title?: string;
}) {
  const look = character.look;
  const skinDark = shade(look.skin, -28);
  // stagger blinking per character
  const delay = `${(character.id.charCodeAt(0) % 7) * 0.6}s`;
  return (
    <svg
      viewBox="0 0 240 330"
      className={`gt-char ${talking ? "gt-talking" : ""} ${className}`}
      role="img"
      aria-label={title ?? `${character.name}, ${expression}`}
      style={{ ["--blink-delay" as string]: delay }}
    >
      <g className="gt-breathe">
        <HairBack look={look} />
        <Outfit look={look} />
        {/* neck */}
        <path d="M104 196 L104 236 C112 244 128 244 136 236 L136 196 Z" fill={skinDark} />
        {/* ears */}
        <ellipse cx="64" cy="156" rx="9" ry="14" fill={look.skin} stroke={skinDark} strokeWidth="1.5" />
        <ellipse cx="176" cy="156" rx="9" ry="14" fill={look.skin} stroke={skinDark} strokeWidth="1.5" />
        {/* head */}
        <path d="M64 140 C62 84 178 84 176 140 C176 176 156 210 120 216 C84 210 64 176 64 140 Z" fill={look.skin} stroke={skinDark} strokeWidth="1.5" />
        {look.age !== "young" && (
          <g stroke={skinDark} strokeWidth="1.5" fill="none" opacity="0.7">
            <path d="M102 178 Q106 186 104 192" />
            <path d="M138 178 Q134 186 136 192" />
            {look.age === "old" && <path d="M76 168 Q80 174 84 172 M164 168 Q160 174 156 172" />}
          </g>
        )}
        {look.blush > 0 && (
          <g fill="#ff8a8a" opacity={0.35 * look.blush}>
            <ellipse cx="88" cy="176" rx="12" ry="6" />
            <ellipse cx="152" cy="176" rx="12" ry="6" />
          </g>
        )}
        <g className="gt-eyes" style={{ animationDelay: delay }}>
          <Eye cx={EYE_L.x} cy={EYE_L.y} look={look} expression={expression} side={-1} />
          <Eye cx={EYE_R.x} cy={EYE_R.y} look={look} expression={expression} side={1} />
        </g>
        <Brows look={look} expression={expression} />
        {/* nose */}
        <path d="M120 162 Q117 172 122 174" stroke={skinDark} strokeWidth="2" fill="none" strokeLinecap="round" />
        <Mouth expression={expression} talking={talking} />
        <HairFront look={look} />
        <Accessories look={look} front />
        {expression === "confused" && <path d="M172 112 C168 120 164 126 168 130 C172 134 178 128 176 120 Z" fill="#7cc4f0" stroke="#4a9fd0" strokeWidth="1" />}
        {expression === "thinking" && (
          <g fill="#ffffff" stroke="#8b8b9a" strokeWidth="1.5">
            <circle cx="186" cy="96" r="5" />
            <circle cx="198" cy="80" r="7" />
            <circle cx="212" cy="60" r="10" />
          </g>
        )}
        {expression === "surprised" && (
          <g stroke="#f2b84b" strokeWidth="3" strokeLinecap="round">
            <path d="M58 82 L48 70 M64 74 L60 60 M182 82 L192 70 M176 74 L180 60" />
          </g>
        )}
        {expression === "annoyed" && (
          <path d="M168 96 l8 -8 m-8 0 l8 8 M176 100 l10 -2" stroke="#d9534f" strokeWidth="3" strokeLinecap="round" />
        )}
      </g>
    </svg>
  );
}
