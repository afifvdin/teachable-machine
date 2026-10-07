import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

export function Menu({ label, items }: { label: string; items: { label: string; danger?: boolean; onSelect: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div className="menu-wrap" ref={ref}>
      <button className="icon-btn" aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="more" />
      </button>
      {open && (
        <div className="menu" role="menu">
          {items.map((it) => (
            <button key={it.label} role="menuitem" className={it.danger ? 'danger' : undefined}
              onClick={() => { setOpen(false); it.onSelect(); }}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
