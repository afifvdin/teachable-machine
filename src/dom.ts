type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...kids: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k in el && !k.includes('-')) (el as any)[k] = v;
    else el.setAttribute(k, String(v));
  }
  for (const c of kids) if (c != null && c !== false) el.append(c);
  return el;
}

let toastEl: HTMLElement | null = null;
let toastTimer = 0;

/** Shows a transient message; pass ms = 0 to keep it until the next call. */
export function toast(msg: string, ms = 2800) {
  toastEl ??= document.body.appendChild(h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' }));
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  if (ms) toastTimer = window.setTimeout(() => toastEl!.classList.remove('show'), ms);
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  h('a', { href: url, download: filename }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read image'));
    img.src = src;
  });
}

/** Small popover menu anchored to a "more" button. */
export function menu(trigger: HTMLElement, items: [string, () => void][]) {
  const list = h('div', { class: 'menu', role: 'menu', hidden: true },
    ...items.map(([label, fn]) => h('button', { role: 'menuitem', onclick: () => { close(); fn(); } }, label)));
  const close = () => { list.hidden = true; document.removeEventListener('pointerdown', outside); };
  const outside = (e: Event) => { if (!list.contains(e.target as Node) && !trigger.contains(e.target as Node)) close(); };
  trigger.addEventListener('click', () => {
    if (!list.hidden) return close();
    list.hidden = false;
    document.addEventListener('pointerdown', outside);
  });
  return h('div', { class: 'menu-wrap' }, trigger, list);
}
