import { COLORS } from '../store';

// Decorative hero diagram: three classes flow into a model, which emits predictions.
const INPUTS = [
  { y: 90, c: COLORS[0], label: 'Cat' },
  { y: 210, c: COLORS[1], label: 'Dog' },
  { y: 330, c: COLORS[2], label: 'Bird' },
];
const CORE = { x: 280, y: 210 };
const BARS = [
  { y: 150, c: COLORS[0], label: 'Cat', anim: 'bar-a' },
  { y: 210, c: COLORS[1], label: 'Dog', anim: 'bar-b' },
  { y: 270, c: COLORS[2], label: 'Bird', anim: 'bar-c' },
];

const inPath = (y: number) => `M120,${y} C200,${y} 200,${CORE.y} ${CORE.x - 46},${CORE.y}`;
const OUT_PATH = `M${CORE.x + 46},${CORE.y} L392,${CORE.y}`;

export function NetworkArt() {
  return (
    <svg className="network-art" viewBox="0 0 560 420" role="img" aria-label="Three image classes flowing into a model that outputs predictions">
      <defs>
        <radialGradient id="core-g" cx="50%" cy="40%" r="60%">
          <stop offset="0" stopColor="#f3edff" />
          <stop offset=".55" stopColor="#b39dff" />
          <stop offset="1" stopColor="#3a3054" />
        </radialGradient>
        <linearGradient id="ring-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c8b6ff" />
          <stop offset="1" stopColor="#ffd6a5" />
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        {INPUTS.map((n, i) => (
          <linearGradient key={i} id={`in-g${i}`} gradientUnits="userSpaceOnUse" x1="120" y1={n.y} x2={CORE.x} y2={CORE.y}>
            <stop offset="0" stopColor={n.c} stopOpacity=".9" />
            <stop offset="1" stopColor="#c8b6ff" stopOpacity=".5" />
          </linearGradient>
        ))}
      </defs>

      {INPUTS.map((n, i) => (
        <g key={i}>
          <path d={inPath(n.y)} stroke={`url(#in-g${i})`} strokeWidth="2" fill="none" opacity=".55" />
          <path d={inPath(n.y)} className="flow" stroke={n.c} strokeWidth="2" fill="none" />
          {[0, 1].map((k) => (
            <circle key={k} r="3.5" fill={n.c}>
              <animateMotion dur="2.4s" begin={`${-(i * 0.5 + k * 1.2)}s`} repeatCount="indefinite" path={inPath(n.y)} />
            </circle>
          ))}
          <g transform={`translate(28 ${n.y - 38})`}>
            <rect width="76" height="76" rx="18" fill="rgba(255,255,255,.04)" stroke={n.c} strokeOpacity=".55" />
            {[0, 1, 2, 3].map((t) => (
              <rect key={t} x={10 + (t % 2) * 30} y={10 + Math.floor(t / 2) * 30} width="26" height="26" rx="7"
                fill={n.c} opacity={0.25 + t * 0.15} />
            ))}
          </g>
          <text x="66" y={n.y + 56} className="art-label" textAnchor="middle">{n.label}</text>
        </g>
      ))}

      <path d={OUT_PATH} stroke="url(#ring-g)" strokeWidth="2" opacity=".6" />
      <circle r="3.5" fill="#ffd6a5">
        <animateMotion dur="1.2s" repeatCount="indefinite" path={OUT_PATH} />
      </circle>

      <g transform={`translate(${CORE.x} ${CORE.y})`}>
        <circle r="62" fill="#b39dff" opacity=".35" filter="url(#glow)" />
        <circle r="46" fill="url(#core-g)" />
        <g className="spin">
          <circle r="58" fill="none" stroke="url(#ring-g)" strokeWidth="2" strokeDasharray="60 304" strokeLinecap="round" />
        </g>
        <g className="spin rev">
          <circle r="66" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1" strokeDasharray="2 8" />
        </g>
        <text y="6" textAnchor="middle" className="core-label">model</text>
      </g>

      <g transform="translate(398 0)">
        <rect x="-6" y="112" width="152" height="196" rx="20" fill="rgba(255,255,255,.035)" stroke="rgba(255,255,255,.09)" />
        {BARS.map((b) => (
          <g key={b.label} transform={`translate(10 ${b.y - 18})`}>
            <text y="-4" className="art-label">{b.label}</text>
            <rect y="4" width="120" height="14" rx="7" fill={b.c} opacity=".15" />
            <rect y="4" width="120" height="14" rx="7" fill={b.c} className={`bar ${b.anim}`} />
          </g>
        ))}
      </g>
    </svg>
  );
}
