import './style.css';
import * as ml from './ml';
import { Webcam } from './webcam';
import { icon, logo } from './icons';
import { h, toast, download, loadImage, menu } from './dom';
import { packProject, unpackProject, packModel } from './project';

type Sample = { id: number; url: string; emb: Float32Array };
type Klass = { id: number; name: string; samples: Sample[] };
type CardRefs = { root: HTMLElement; body: HTMLElement; count: HTMLElement; thumbs: HTMLElement };

const COLORS = ['#e8710a', '#1a73e8', '#d01884', '#12b5cb', '#9334e6', '#188038', '#f9ab00', '#c5221f'];
const DEFAULTS: ml.TrainOptions = { epochs: 50, batchSize: 16, learningRate: 0.001 };
const RECORD_FPS = 12;

const cam = new Webcam();
const state = {
  classes: [] as Klass[],
  options: { ...DEFAULTS },
  nextId: 1,
  version: 0, // bumps whenever training data changes
  trainedVersion: -1,
  trainedIds: [] as number[],
  trainedNames: [] as string[],
  training: false,
};
const uid = () => state.nextId++;
const newClass = (n = state.classes.length + 1): Klass => ({ id: uid(), name: `Class ${n}`, samples: [] });
const isStale = () => ml.hasModel() && state.trainedVersion !== state.version;
const hasSamples = () => state.classes.some((k) => k.samples.length);

function markChanged() {
  state.version++;
  renderTrainStatus();
}

/* ---------- Shell ---------- */

const app = document.getElementById('app')!;
const projectActions = h('nav', { class: 'top-actions', 'aria-label': 'Project' },
  h('button', { class: 'btn ghost', onclick: newProject, title: 'New project' }, icon('new'), h('span', {}, 'New')),
  h('button', { class: 'btn ghost', onclick: () => projectInput.click(), title: 'Open project' }, icon('open'), h('span', {}, 'Open')),
  h('button', { class: 'btn ghost', onclick: saveProject, title: 'Save project to file' }, icon('save'), h('span', {}, 'Save')),
);
const projectInput = h('input', { type: 'file', accept: '.zip,.tm', hidden: true, onchange: openProject });
const topbar = h('header', { class: 'topbar' },
  h('a', { class: 'brand', href: '#/' }, logo(), h('span', {}, 'Teachable Machine')),
  projectActions,
  projectInput,
);

/* ---------- Landing ---------- */

const step = (n: string, ic: string, title: string, text: string) =>
  h('li', { class: 'step' }, h('div', { class: 'step-icon' }, icon(ic)), h('span', { class: 'step-n' }, n), h('h3', {}, title), h('p', {}, text));

const landing = h('main', { class: 'landing' },
  h('section', { class: 'hero' },
    h('p', { class: 'eyebrow' }, 'Image classification, no code'),
    h('h1', {}, 'Teach your computer to recognize anything you can point a camera at.'),
    h('p', { class: 'lede' }, 'Show it a few examples of each thing, train in seconds, and export a model you can use in your own sites and apps. Everything runs in your browser; your images never leave your device.'),
    h('div', { class: 'hero-cta' },
      h('a', { class: 'btn primary lg', href: '#/train' }, 'Get started'),
      h('a', { class: 'btn ghost lg', href: 'https://github.com/afifvdin/teachable-machine', target: '_blank', rel: 'noopener' }, 'View source'),
    ),
  ),
  h('ol', { class: 'steps' },
    step('1', 'webcam', 'Gather', 'Record examples with your webcam or upload images, grouped into the classes you want to tell apart.'),
    step('2', 'train', 'Train', 'Hit train. A pre-trained MobileNet does the heavy lifting, so a good model takes seconds, not hours.'),
    step('3', 'download', 'Export', 'Test it live, then download a standard TensorFlow.js model to drop into your own project.'),
  ),
  h('footer', { class: 'foot' },
    'An open-source take on Google’s Teachable Machine, built by ',
    h('a', { href: 'https://github.com/afifvdin', target: '_blank', rel: 'noopener' }, '@afifvdin'),
    '. Not affiliated with Google.'),
);

/* ---------- Studio ---------- */

const links = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
links.classList.add('links');
links.setAttribute('aria-hidden', 'true');

const classList = h('section', { class: 'col col-classes', 'aria-label': 'Classes' });
const cards = new Map<number, CardRefs>();

const trainBtn = h('button', { class: 'btn primary wide', onclick: onTrain }, 'Train Model');
const trainStatus = h('p', { class: 'train-status' });
const progressFill = h('div', { class: 'progress-fill' });
const progress = h('div', { class: 'progress', hidden: true }, progressFill);

const numField = (label: string, key: 'epochs' | 'learningRate', attrs: Record<string, unknown>) =>
  h('label', { class: 'field' }, h('span', {}, label),
    h('input', { type: 'number', value: String(state.options[key]), ...attrs, 'data-key': key,
      onchange: (e: Event) => {
        const el = e.target as HTMLInputElement;
        const v = Number(el.value);
        if (Number.isFinite(v) && v > 0) state.options[key] = v;
        el.value = String(state.options[key]);
      } }));
const batchSelect = h('select', { 'data-key': 'batchSize', onchange: (e: Event) => (state.options.batchSize = Number((e.target as HTMLSelectElement).value)) },
  ...[16, 32, 64, 128, 256, 512].map((n) => h('option', { value: String(n) }, String(n))));
const advanced = h('details', { class: 'advanced' },
  h('summary', {}, 'Advanced'),
  numField('Epochs', 'epochs', { min: 1, max: 1000, step: 1 }),
  h('label', { class: 'field' }, h('span', {}, 'Batch size'), batchSelect),
  numField('Learning rate', 'learningRate', { min: 0.00001, max: 1, step: 0.0001 }),
  h('button', { class: 'btn ghost sm', onclick: () => { state.options = { ...DEFAULTS }; syncOptions(); } }, 'Reset defaults'),
);
const trainCard = h('section', { class: 'card train-card', 'aria-label': 'Training' },
  h('h2', {}, 'Training'), trainBtn, progress, trainStatus, advanced);

const exportBtn = h('button', { class: 'btn ghost sm', onclick: openExport, disabled: true }, icon('download'), h('span', {}, 'Export Model'));
const previewBody = h('div', { class: 'preview-body' });
const previewCard = h('section', { class: 'card preview-card', 'aria-label': 'Preview' },
  h('header', { class: 'card-head' }, h('h2', {}, 'Preview'), exportBtn), previewBody);

const studio = h('main', { class: 'studio' },
  classList,
  h('div', { class: 'col col-train' }, trainCard),
  h('div', { class: 'col col-preview' }, previewCard),
);
studio.prepend(links);

app.append(topbar, landing, studio);

/* ---------- Class cards ---------- */

function renderClasses() {
  closeCapture();
  cards.clear();
  classList.replaceChildren(
    ...state.classes.map(buildCard),
    h('button', { class: 'add-class', onclick: () => { state.classes.push(newClass()); markChanged(); renderClasses(); } },
      icon('add'), h('span', {}, 'Add a class')),
  );
  queueLinks();
}

function buildCard(k: Klass, i: number) {
  const count = h('p', { class: 'count' });
  const thumbs = h('div', { class: 'thumbs' });
  const files = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true,
    onchange: () => { const list = [...(files.files ?? [])]; files.value = ''; addFiles(k, list); } });
  const nameInput = h('input', { class: 'class-name', value: k.name, 'aria-label': 'Class name', spellcheck: false,
    oninput: () => { k.name = nameInput.value; refreshLabels(); },
    onblur: () => { if (!nameInput.value.trim()) { nameInput.value = k.name = `Class ${i + 1}`; refreshLabels(); } },
    onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') nameInput.blur(); } });
  const more = menu(h('button', { class: 'icon-btn', 'aria-label': `Options for ${k.name}` }, icon('more')), [
    ['Clear samples', () => { k.samples = []; renderSamples(k); markChanged(); }],
    ['Delete class', () => deleteClass(k)],
  ]);
  const body = h('div', { class: 'class-body' },
    count,
    h('div', { class: 'samples-row' },
      h('div', { class: 'sources' },
        h('button', { class: 'source', onclick: () => openCapture(k) }, icon('webcam'), h('span', {}, 'Webcam')),
        h('button', { class: 'source', onclick: () => files.click() }, icon('upload'), h('span', {}, 'Upload')),
        files),
      thumbs));
  const root = h('article', { class: 'card class-card', style: `--c:${COLORS[i % COLORS.length]}`,
    ondragover: (e: DragEvent) => { e.preventDefault(); root.classList.add('drop'); },
    ondragleave: () => root.classList.remove('drop'),
    ondrop: (e: DragEvent) => { e.preventDefault(); root.classList.remove('drop'); addFiles(k, [...(e.dataTransfer?.files ?? [])]); } },
    h('header', { class: 'card-head' }, nameInput, more),
    body);
  cards.set(k.id, { root, body, count, thumbs });
  renderSamples(k);
  return root;
}

function renderSamples(k: Klass) {
  const refs = cards.get(k.id);
  if (!refs) return;
  refs.thumbs.replaceChildren(...k.samples.slice().reverse().map((s) => thumb(k, s)));
  updateCount(k);
}

function updateCount(k: Klass) {
  const n = k.samples.length;
  const refs = cards.get(k.id);
  if (refs) refs.count.textContent = n ? `${n} Image Sample${n === 1 ? '' : 's'}` : 'Add Image Samples:';
}

function thumb(k: Klass, s: Sample) {
  const el = h('div', { class: 'thumb' },
    h('img', { src: s.url, alt: '', draggable: false }),
    h('button', { class: 'thumb-del', 'aria-label': 'Delete sample', onclick: () => {
      k.samples = k.samples.filter((x) => x !== s);
      el.remove();
      updateCount(k);
      markChanged();
    } }, icon('close')));
  return el;
}

async function addSample(k: Klass, canvas: HTMLCanvasElement) {
  const url = canvas.toDataURL('image/jpeg', 0.85);
  const emb = await ml.embed(canvas);
  if (!state.classes.includes(k)) return;
  const s = { id: uid(), url, emb };
  k.samples.push(s);
  cards.get(k.id)?.thumbs.prepend(thumb(k, s));
  updateCount(k);
  markChanged();
}

async function addFiles(k: Klass, files: File[]) {
  const images = files.filter((f) => f.type.startsWith('image/'));
  if (!images.length) return;
  if (images.length > 3) toast(`Adding ${images.length} images…`, 0);
  try {
    for (const f of images) {
      const url = URL.createObjectURL(f);
      try {
        await addSample(k, ml.cropTo(await loadImage(url)));
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    if (images.length > 3) toast(`Added ${images.length} images to ${k.name}`);
  } catch (e) {
    toast(`Couldn’t add image: ${errMsg(e)}`);
  }
}

function deleteClass(k: Klass) {
  if (k.samples.length && !confirm(`Delete “${k.name}” and its ${k.samples.length} samples?`)) return;
  state.classes = state.classes.filter((x) => x !== k);
  markChanged();
  renderClasses();
}

/* ---------- Webcam capture ---------- */

let capture: { k: Klass; video: HTMLVideoElement; panel: HTMLElement; stop: () => void } | null = null;

async function openCapture(k: Klass) {
  closeCapture();
  const refs = cards.get(k.id)!;
  const video = h('video', { class: 'cam', autoplay: true, muted: true, playsInline: true });
  let recording = false;
  const record = async () => {
    let last = 0;
    while (recording) {
      const now = performance.now();
      if (now - last >= 1000 / RECORD_FPS && video.readyState >= 2) {
        last = now;
        await addSample(k, ml.cropTo(video, cam.mirrored));
      }
      await new Promise(requestAnimationFrame);
    }
  };
  const start = () => { if (recording) return; recording = true; recBtn.classList.add('on'); record(); };
  const stop = () => { recording = false; recBtn.classList.remove('on'); };
  const recBtn = h('button', { class: 'btn primary wide record',
    onpointerdown: (e: PointerEvent) => { try { recBtn.setPointerCapture(e.pointerId); } catch {} start(); },
    onpointerup: stop, onpointercancel: stop, onlostpointercapture: stop,
    oncontextmenu: (e: Event) => e.preventDefault(),
    onkeydown: (e: KeyboardEvent) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); start(); } },
    onkeyup: (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') stop(); } }, 'Hold to Record');
  const panel = h('div', { class: 'capture' },
    h('div', { class: 'capture-head' }, h('span', {}, 'Webcam'),
      h('button', { class: 'icon-btn', 'aria-label': 'Close webcam', onclick: closeCapture }, icon('close'))),
    h('div', { class: 'cam-wrap' }, video,
      h('button', { class: 'icon-btn flip', 'aria-label': 'Switch camera', onclick: () => cam.flip().catch((e) => toast(errMsg(e))) }, icon('flip'))),
    recBtn);
  refs.body.prepend(panel);
  refs.root.classList.add('capturing');
  capture = { k, video, panel, stop };
  queueLinks();
  ml.loadBase().catch(() => {});
  try {
    await cam.attach(video);
  } catch (e) {
    if (capture?.video === video) closeCapture();
    toast(`Camera unavailable: ${errMsg(e)}`, 5000);
  }
}

function closeCapture() {
  if (!capture) return;
  capture.stop();
  cam.detach(capture.video);
  capture.panel.remove();
  cards.get(capture.k.id)?.root.classList.remove('capturing');
  capture = null;
  queueLinks();
}

/* ---------- Training ---------- */

function syncOptions() {
  for (const el of advanced.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-key]'))
    el.value = String(state.options[el.dataset.key as keyof ml.TrainOptions]);
}

function renderTrainStatus(p?: ml.Progress) {
  trainBtn.textContent = state.training ? 'Stop training' : ml.hasModel() && !isStale() ? 'Model Trained' : 'Train Model';
  trainBtn.classList.toggle('done', ml.hasModel() && !isStale() && !state.training);
  progress.hidden = !state.training;
  if (state.training) {
    const pct = p ? (p.epoch / p.epochs) * 100 : 0;
    progressFill.style.width = `${pct}%`;
    trainStatus.textContent = p ? `Epoch ${p.epoch} / ${p.epochs} · accuracy ${(p.acc * 100).toFixed(0)}%` : 'Preparing…';
  } else if (isStale()) {
    trainStatus.textContent = 'Your samples changed. Train again to update the model.';
  } else if (ml.hasModel()) {
    trainStatus.textContent = '';
  } else {
    trainStatus.textContent = 'Add samples to at least two classes, then train.';
  }
  trainStatus.classList.toggle('warn', isStale() && !state.training);
}

async function onTrain() {
  if (state.training) return ml.stopTraining();
  if (state.classes.length < 2) return toast('Add at least two classes to train.');
  const empty = state.classes.find((k) => !k.samples.length);
  if (empty) return toast(`“${empty.name}” has no samples yet.`);

  const snapshot = state.classes.map((k) => ({ id: k.id, name: k.name, embs: k.samples.map((s) => s.emb) }));
  const version = state.version;
  state.training = true;
  renderTrainStatus();
  try {
    await ml.train(snapshot.map((s) => s.embs), state.options, renderTrainStatus);
    state.trainedIds = snapshot.map((s) => s.id);
    state.trainedNames = snapshot.map((s) => s.name);
    state.trainedVersion = version;
  } catch (e) {
    toast(`Training failed: ${errMsg(e)}`, 5000);
  } finally {
    state.training = false;
    renderTrainStatus();
    renderPreview();
  }
}

/* ---------- Preview ---------- */

const preview = {
  on: true,
  source: 'webcam' as 'webcam' | 'file',
  video: null as HTMLVideoElement | null,
  rows: [] as { label: HTMLElement; fill: HTMLElement; pct: HTMLElement }[],
  scratch: document.createElement('canvas'),
  looping: false,
};

function renderPreview() {
  stopPreviewCam();
  exportBtn.disabled = !ml.hasModel();
  if (!ml.hasModel()) {
    previewBody.replaceChildren(h('p', { class: 'muted' }, 'You must train a model on the left before you can preview it here.'));
    return;
  }

  const toggle = h('input', { type: 'checkbox', checked: preview.on, onchange: () => { preview.on = toggle.checked; renderPreview(); } });
  const sourceSel = h('select', { 'aria-label': 'Input source', disabled: !preview.on,
    onchange: () => { preview.source = sourceSel.value as 'webcam' | 'file'; renderPreview(); } },
    h('option', { value: 'webcam', selected: preview.source === 'webcam' }, 'Webcam'),
    h('option', { value: 'file', selected: preview.source === 'file' }, 'File'));

  let media: HTMLElement | null = null;
  if (preview.on && preview.source === 'webcam') {
    const video = h('video', { class: 'cam', autoplay: true, muted: true, playsInline: true });
    preview.video = video;
    media = h('div', { class: 'cam-wrap' }, video,
      h('button', { class: 'icon-btn flip', 'aria-label': 'Switch camera', onclick: () => cam.flip().catch((e) => toast(errMsg(e))) }, icon('flip')));
    cam.attach(video).then(startLoop).catch((e) => toast(`Camera unavailable: ${errMsg(e)}`, 5000));
  } else if (preview.on) {
    media = fileDrop();
  }

  preview.rows = state.trainedIds.map((_, i) => {
    const pct = h('span', { class: 'bar-pct' }, '0%');
    const fill = h('div', { class: 'bar-fill' }, pct);
    return { label: h('span', { class: 'bar-label' }), fill, pct };
  });
  previewBody.replaceChildren(
    h('div', { class: 'input-row' },
      h('label', { class: 'switch' }, h('span', {}, 'Input'), toggle, h('span', { class: 'switch-ui' }, h('span', {}, preview.on ? 'ON' : 'OFF'))),
      sourceSel),
    ...(media ? [media] : []),
    h('h3', { class: 'output-title' }, 'Output'),
    h('div', { class: 'bars' }, ...preview.rows.map((r, i) =>
      h('div', { class: 'bar-row', style: `--c:${COLORS[i % COLORS.length]}` }, r.label, h('div', { class: 'bar' }, r.fill)))),
  );
  refreshLabels();
  queueLinks();
}

function fileDrop() {
  const img = h('img', { class: 'drop-img', alt: '', hidden: true });
  const input = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: () => { const f = input.files?.[0]; input.value = ''; if (f) show(f); } });
  const show = async (f: File) => {
    const url = URL.createObjectURL(f);
    try {
      const el = await loadImage(url);
      img.src = url;
      img.hidden = false;
      hint.hidden = true;
      const p = await ml.classify(ml.cropTo(el, false, preview.scratch));
      if (p) updateBars(p);
    } catch (e) {
      toast(errMsg(e));
    }
  };
  const hint = h('span', { class: 'drop-hint' }, icon('image'), h('span', {}, 'Choose an image, or drag & drop it here'));
  const zone = h('button', { class: 'drop-zone', onclick: () => input.click(),
    ondragover: (e: DragEvent) => { e.preventDefault(); zone.classList.add('drop'); },
    ondragleave: () => zone.classList.remove('drop'),
    ondrop: (e: DragEvent) => { e.preventDefault(); zone.classList.remove('drop'); const f = e.dataTransfer?.files[0]; if (f) show(f); } },
    hint, img, input);
  return zone;
}

function stopPreviewCam() {
  if (preview.video) cam.detach(preview.video);
  preview.video = null;
  preview.looping = false;
}

function startLoop() {
  if (preview.looping) return;
  preview.looping = true;
  const tick = async () => {
    const v = preview.video;
    if (!preview.looping || !v) return;
    if (v.readyState >= 2 && !state.training) {
      const p = await ml.classify(ml.cropTo(v, cam.mirrored, preview.scratch));
      if (p && preview.video === v) updateBars(p);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function updateBars(p: Float32Array) {
  preview.rows.forEach((r, i) => {
    const pct = Math.round((p[i] ?? 0) * 100);
    r.fill.style.width = `${pct}%`;
    r.pct.textContent = `${pct}%`;
  });
}

function refreshLabels() {
  preview.rows.forEach((r, i) => {
    r.label.textContent = state.classes.find((k) => k.id === state.trainedIds[i])?.name ?? state.trainedNames[i];
  });
}

/* ---------- Export ---------- */

const SNIPPET = `<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4/dist/tf.min.js"></script>
<script type="module">
  // Put model.json, weights.bin and metadata.json next to this page.
  const model = await tf.loadLayersModel('./model.json');
  const { labels, imageSize } = await (await fetch('./metadata.json')).json();

  // img: any <img>, <video> or <canvas>, ideally a centered square crop
  function classify(img) {
    return tf.tidy(() => {
      const x = tf.browser.fromPixels(img)
        .resizeBilinear([imageSize, imageSize])
        .toFloat().div(127.5).sub(1)  // scale to [-1, 1]
        .expandDims();
      const probs = model.predict(x).dataSync();
      return labels.map((label, i) => ({ label, probability: probs[i] }));
    });
  }
</script>`;

function openExport() {
  const labels = state.trainedIds.map((id, i) => state.classes.find((k) => k.id === id)?.name ?? state.trainedNames[i]);
  const dlBtn = h('button', { class: 'btn primary', onclick: async () => {
    dlBtn.disabled = true;
    try {
      download(await packModel(labels), 'teachable-machine-model.zip');
    } catch (e) {
      toast(`Export failed: ${errMsg(e)}`, 5000);
    } finally {
      dlBtn.disabled = false;
    }
  } }, icon('download'), h('span', {}, 'Download my model'));
  const copyBtn = h('button', { class: 'btn ghost sm', onclick: async () => {
    await navigator.clipboard.writeText(SNIPPET).catch(() => {});
    copyBtn.textContent = 'Copied';
    setTimeout(() => (copyBtn.textContent = 'Copy'), 1500);
  } }, 'Copy');
  const dialog = h('dialog', { class: 'modal', onclose: () => dialog.remove(),
    onclick: (e: MouseEvent) => { if (e.target === dialog) dialog.close(); } },
    h('div', { class: 'modal-inner' },
      h('header', { class: 'card-head' }, h('h2', {}, 'Export your model'),
        h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: () => dialog.close() }, icon('close'))),
      h('p', {}, 'A standard TensorFlow.js layers model: ', h('code', {}, 'model.json'), ', ', h('code', {}, 'weights.bin'),
        ' and ', h('code', {}, 'metadata.json'), ' (your class labels). It takes a 224×224 image scaled to [-1, 1] and returns one probability per class.'),
      dlBtn,
      h('div', { class: 'snippet-head' }, h('h3', {}, 'Use it on a web page'), copyBtn),
      h('pre', { class: 'snippet' }, h('code', {}, SNIPPET)),
    ));
  document.body.append(dialog);
  dialog.showModal();
}

/* ---------- Project files ---------- */

async function saveProject() {
  if (!hasSamples()) return toast('Nothing to save yet. Add some samples first.');
  toast('Packing project…', 0);
  try {
    download(await packProject(state.classes, state.options), 'teachable-machine-project.zip');
    toast('Project saved');
  } catch (e) {
    toast(`Save failed: ${errMsg(e)}`, 5000);
  }
}

async function openProject() {
  const file = projectInput.files?.[0];
  projectInput.value = '';
  if (!file) return;
  if (hasSamples() && !confirm('Replace the current project? Unsaved samples will be lost.')) return;
  try {
    toast('Opening project…', 0);
    const p = await unpackProject(file);
    const total = p.classes.reduce((n, k) => n + k.urls.length, 0);
    let done = 0;
    const classes: Klass[] = [];
    for (const k of p.classes) {
      const samples: Sample[] = [];
      for (const url of k.urls) {
        const emb = await ml.embed(ml.cropTo(await loadImage(url)));
        samples.push({ id: uid(), url, emb });
        if (++done % 10 === 0) toast(`Opening project… ${done}/${total}`, 0);
      }
      classes.push({ id: uid(), name: k.name, samples });
    }
    resetProject(classes);
    if (p.options) state.options = { ...DEFAULTS, ...p.options };
    syncOptions();
    toast(`Opened ${classes.length} classes, ${total} samples`);
  } catch (e) {
    toast(`Couldn’t open project: ${errMsg(e)}`, 5000);
  }
}

function newProject() {
  if (hasSamples() && !confirm('Start a new project? Unsaved samples will be lost.')) return;
  resetProject([newClass(1), newClass(2)]);
  state.options = { ...DEFAULTS };
  syncOptions();
}

function resetProject(classes: Klass[]) {
  ml.stopTraining();
  ml.reset();
  state.classes = classes;
  state.trainedIds = [];
  state.trainedNames = [];
  markChanged();
  renderClasses();
  renderPreview();
}

/* ---------- Connector lines ---------- */

let linksQueued = false;
function queueLinks() {
  if (linksQueued) return;
  linksQueued = true;
  requestAnimationFrame(() => {
    linksQueued = false;
    drawLinks();
  });
}

function drawLinks() {
  links.replaceChildren();
  if (studio.hidden || matchMedia('(max-width: 1080px)').matches) return;
  const box = studio.getBoundingClientRect();
  links.setAttribute('width', String(studio.scrollWidth));
  links.setAttribute('height', String(studio.scrollHeight));
  const t = trainCard.getBoundingClientRect();
  const pv = previewCard.getBoundingClientRect();
  const ty = t.top + t.height / 2 - box.top;
  const curve = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = (x2 - x1) / 2;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`);
    links.append(path);
  };
  for (const { root } of cards.values()) {
    const r = root.getBoundingClientRect();
    curve(r.right - box.left, r.top + r.height / 2 - box.top, t.left - box.left, ty);
  }
  curve(t.right - box.left, ty, pv.left - box.left, pv.top + pv.height / 2 - box.top);
}

new ResizeObserver(queueLinks).observe(studio);
for (const el of [classList, trainCard, previewCard]) new ResizeObserver(queueLinks).observe(el);

/* ---------- Routing & boot ---------- */

function route() {
  const inStudio = location.hash.startsWith('#/train');
  landing.hidden = inStudio;
  studio.hidden = !inStudio;
  projectActions.hidden = !inStudio;
  document.title = inStudio ? 'Train · Teachable Machine' : 'Teachable Machine';
  if (inStudio) {
    ml.loadBase().catch((e) => toast(`Couldn’t load MobileNet: ${errMsg(e)}`, 6000));
    renderPreview();
    queueLinks();
  } else {
    closeCapture();
    stopPreviewCam();
  }
  window.scrollTo(0, 0);
}

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

window.addEventListener('hashchange', route);
window.addEventListener('beforeunload', (e) => {
  if (hasSamples()) e.preventDefault();
});

state.classes = [newClass(1), newClass(2)];
renderClasses();
renderTrainStatus();
route();
