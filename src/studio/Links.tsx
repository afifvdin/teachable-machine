import { useEffect, useState, type RefObject } from 'react';

type Path = { key: string; d: string; from: [number, number]; to: [number, number]; color: string };

type Props = {
  grid: RefObject<HTMLElement | null>;
  cards: RefObject<Map<number, HTMLElement>>;
  train: RefObject<HTMLElement | null>;
  preview: RefObject<HTMLElement | null>;
  classes: { id: number; color: string }[];
  mode: 'idle' | 'flow' | 'live';
};

const curve = (x1: number, y1: number, x2: number, y2: number) => {
  const dx = (x2 - x1) / 2;
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
};

/** Curved connectors from each class to the trainer, and from the trainer to the preview. */
export function Links({ grid, cards, train, preview, classes, mode }: Props) {
  const [paths, setPaths] = useState<Path[]>([]);
  const key = classes.map((c) => c.id + c.color).join();

  useEffect(() => {
    const g = grid.current;
    if (!g) return;
    const draw = () => {
      const t = train.current?.getBoundingClientRect();
      const p = preview.current?.getBoundingClientRect();
      if (!t || !p || matchMedia('(max-width: 1080px)').matches) return setPaths([]);
      const box = g.getBoundingClientRect();
      const tx = t.left - box.left;
      const ty = t.top + t.height / 2 - box.top;
      const out: Path[] = [];
      for (const c of classes) {
        const r = cards.current.get(c.id)?.getBoundingClientRect();
        if (!r) continue;
        const from: [number, number] = [r.right - box.left, r.top + r.height / 2 - box.top];
        out.push({ key: String(c.id), d: curve(...from, tx, ty), from, to: [tx, ty], color: c.color });
      }
      const from: [number, number] = [t.right - box.left, ty];
      const to: [number, number] = [p.left - box.left, p.top + p.height / 2 - box.top];
      out.push({ key: 'out', d: curve(...from, ...to), from, to, color: '#22d3ee' });
      setPaths(out);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(g);
    g.querySelectorAll('.col').forEach((el) => ro.observe(el));
    window.addEventListener('resize', draw);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', draw);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <svg className={`links ${mode}`} aria-hidden="true">
      <defs>
        {paths.map((p) => (
          <linearGradient key={p.key} id={`lk-${p.key}`} gradientUnits="userSpaceOnUse" x1={p.from[0]} y1={p.from[1]} x2={p.to[0]} y2={p.to[1]}>
            <stop offset="0" stopColor={p.key === 'out' ? '#8b6cff' : p.color} />
            <stop offset="1" stopColor={p.key === 'out' ? '#22d3ee' : '#8b6cff'} />
          </linearGradient>
        ))}
      </defs>
      {paths.map((p) => (
        <g key={p.key}>
          <path d={p.d} className="link-base" stroke={`url(#lk-${p.key})`} />
          <path d={p.d} className="link-flow" stroke={`url(#lk-${p.key})`} />
          <circle className="link-end" cx={p.from[0]} cy={p.from[1]} r="4" fill={p.key === 'out' ? '#8b6cff' : p.color} />
        </g>
      ))}
    </svg>
  );
}
