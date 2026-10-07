import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { toast } from 'sonner';
import * as ml from '../ml';
import { Icon } from '../components/Icon';
import { initState, newClass, reducer, uid, colorOf, type Klass, type Sample } from '../store';
import { packProject, unpackProject } from '../project';
import { download, errMsg, loadImage } from '../util';
import { ClassCard } from './ClassCard';
import { TrainPanel, DEFAULT_OPTIONS } from './TrainPanel';
import { PreviewPanel } from './PreviewPanel';
import { ExportDialog } from './ExportDialog';
import { Links } from './Links';

type Model = { ids: number[]; names: string[]; version: number };

export function Studio({ active }: { active: boolean }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [capturingId, setCapturingId] = useState<number | null>(null);
  const [training, setTraining] = useState(false);
  const [progress, setProgress] = useState<ml.Progress | null>(null);
  const [model, setModel] = useState<Model | null>(null);
  const [exporting, setExporting] = useState(false);
  const [baseReady, setBaseReady] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);
  const trainRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  const cardEls = useRef(new Map<number, HTMLElement>());
  const projectInput = useRef<HTMLInputElement>(null);

  const hasSamples = state.classes.some((k) => k.samples.length);
  const totalSamples = state.classes.reduce((n, k) => n + k.samples.length, 0);
  const stale = model != null && model.version !== state.version;
  const labels = model ? model.ids.map((id, i) => state.classes.find((k) => k.id === id)?.name ?? model.names[i]) : [];

  useEffect(() => {
    if (!active) return setCapturingId(null);
    ml.loadBase()
      .then(() => setBaseReady(true))
      .catch((e) => toast.error(`Couldn’t load MobileNet: ${errMsg(e)}`));
  }, [active]);

  useEffect(() => {
    if (!hasSamples) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasSamples]);

  const register = useCallback((id: number, el: HTMLElement | null) => {
    if (el) cardEls.current.set(id, el);
    else cardEls.current.delete(id);
  }, []);

  const addSample = useCallback(async (id: number, canvas: HTMLCanvasElement) => {
    const url = canvas.toDataURL('image/jpeg', 0.85);
    const emb = await ml.embed(canvas);
    dispatch({ type: 'addSample', id, sample: { id: uid(), url, emb } });
  }, []);

  const addFiles = useCallback(async (id: number, files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (!images.length) return;
    const t = images.length > 3 ? toast.loading(`Adding ${images.length} images…`) : undefined;
    try {
      for (const f of images) {
        const url = URL.createObjectURL(f);
        try {
          await addSample(id, ml.cropTo(await loadImage(url)));
        } finally {
          URL.revokeObjectURL(url);
        }
      }
      if (t) toast.success(`Added ${images.length} images`, { id: t });
    } catch (e) {
      toast.error(`Couldn’t add image: ${errMsg(e)}`, { id: t });
    }
  }, [addSample]);

  async function onTrain() {
    if (training) return ml.stopTraining();
    if (state.classes.length < 2) return toast('Add at least two classes to train.');
    const empty = state.classes.find((k) => !k.samples.length);
    if (empty) return toast(`“${empty.name}” has no samples yet.`);

    const snapshot = state.classes;
    const version = state.version;
    setTraining(true);
    setProgress(null);
    try {
      await ml.train(snapshot.map((k) => k.samples.map((s) => s.emb)), options, setProgress);
      setModel({ ids: snapshot.map((k) => k.id), names: snapshot.map((k) => k.name), version });
      toast.success('Model trained. Try it in the preview.');
    } catch (e) {
      toast.error(`Training failed: ${errMsg(e)}`);
    } finally {
      setTraining(false);
    }
  }

  function resetProject(classes: Klass[]) {
    ml.stopTraining();
    ml.reset();
    setModel(null);
    setCapturingId(null);
    dispatch({ type: 'load', classes });
  }

  function newProject() {
    if (hasSamples && !confirm('Start a new project? Unsaved samples will be lost.')) return;
    resetProject([newClass(1), newClass(2)]);
    setOptions(DEFAULT_OPTIONS);
  }

  async function saveProject() {
    if (!hasSamples) return toast('Nothing to save yet. Add some samples first.');
    const t = toast.loading('Packing project…');
    try {
      download(await packProject(state.classes, options), 'teachable-machine-project.zip');
      toast.success('Project saved', { id: t });
    } catch (e) {
      toast.error(`Save failed: ${errMsg(e)}`, { id: t });
    }
  }

  async function openProject(file?: File) {
    if (!file) return;
    if (hasSamples && !confirm('Replace the current project? Unsaved samples will be lost.')) return;
    const t = toast.loading('Opening project…');
    try {
      const p = await unpackProject(file);
      const total = p.classes.reduce((n, k) => n + k.urls.length, 0);
      let done = 0;
      const classes: Klass[] = [];
      for (const k of p.classes) {
        const samples: Sample[] = [];
        for (const url of k.urls) {
          samples.push({ id: uid(), url, emb: await ml.embed(ml.cropTo(await loadImage(url))) });
          if (++done % 10 === 0) toast.loading(`Opening project… ${done}/${total}`, { id: t });
        }
        classes.push({ id: uid(), name: k.name, samples });
      }
      resetProject(classes);
      setOptions({ ...DEFAULT_OPTIONS, ...p.options });
      toast.success(`Opened ${classes.length} classes, ${total} samples`, { id: t });
    } catch (e) {
      toast.error(`Couldn’t open project: ${errMsg(e)}`, { id: t });
    }
  }

  const ready = model != null && !training;

  return (
    <main className="studio" hidden={!active}>
      <div className="studio-bar">
        <div className="studio-meta">
          <span className="chip"><span className={`live-dot${baseReady ? ' on' : ''}`} />{baseReady ? 'MobileNet loaded' : 'Loading MobileNet…'}</span>
          <span className="chip muted">{state.classes.length} classes · {totalSamples} samples</span>
        </div>
        <div className="pill-group" role="toolbar" aria-label="Project">
          <button onClick={newProject} title="New project"><Icon name="new" size={18} /><span>New</span></button>
          <button onClick={() => projectInput.current?.click()} title="Open project"><Icon name="open" size={18} /><span>Open</span></button>
          <button onClick={saveProject} title="Save project to file"><Icon name="save" size={18} /><span>Save</span></button>
        </div>
        <input ref={projectInput} type="file" accept=".zip" hidden
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; openProject(f); }} />
      </div>

      <div className="studio-grid" ref={gridRef}>
        {active && (
          <Links
            grid={gridRef}
            cards={cardEls}
            train={trainRef}
            preview={previewRef}
            classes={state.classes.map((k, i) => ({ id: k.id, color: colorOf(i) }))}
            mode={training ? 'flow' : ready && !stale ? 'live' : 'idle'}
          />
        )}
        <section className="col col-classes" aria-label="Classes">
          {state.classes.map((k, i) => (
            <ClassCard
              key={k.id}
              k={k}
              index={i}
              color={colorOf(i)}
              capturing={capturingId === k.id}
              setCapturing={setCapturingId}
              dispatch={dispatch}
              addSample={addSample}
              addFiles={addFiles}
              register={register}
            />
          ))}
          <button className="add-class" onClick={() => dispatch({ type: 'addClass' })}>
            <Icon name="add" /> Add a class
          </button>
        </section>
        <div className="col col-train">
          <TrainPanel ref={trainRef} training={training} progress={progress} trained={model != null} stale={stale}
            options={options} setOptions={setOptions} onTrain={onTrain} />
        </div>
        <div className="col col-preview">
          <PreviewPanel ref={previewRef} active={active} ready={model != null} training={training} labels={labels}
            colors={labels.map((_, i) => {
              const idx = state.classes.findIndex((k) => k.id === model!.ids[i]);
              return colorOf(idx >= 0 ? idx : i);
            })}
            onExport={() => setExporting(true)} />
        </div>
      </div>

      {exporting && <ExportDialog labels={labels} onClose={() => setExporting(false)} />}
    </main>
  );
}
