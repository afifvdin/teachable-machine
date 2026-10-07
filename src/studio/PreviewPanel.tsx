import { forwardRef, useEffect, useRef, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import * as ml from '../ml';
import { Icon } from '../components/Icon';
import { cam, useCamera } from '../useCamera';
import { errMsg, loadImage } from '../util';

type Props = {
  active: boolean;
  ready: boolean;
  training: boolean;
  labels: string[];
  colors: string[];
  onExport: () => void;
};

export const PreviewPanel = forwardRef<HTMLElement, Props>(function PreviewPanel({ active, ready, training, labels, colors, onExport }, ref) {
  const [on, setOn] = useState(true);
  const [source, setSource] = useState<'webcam' | 'file'>('webcam');
  const [probs, setProbs] = useState<number[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const camOn = active && ready && on && source === 'webcam';
  const camState = useCamera(videoRef, camOn);
  const trainingRef = useRef(training);
  trainingRef.current = training;

  useEffect(() => setProbs([]), [labels.length, source, on]);

  useEffect(() => {
    if (camState !== 'live') return;
    let alive = true;
    const scratch = document.createElement('canvas');
    const tick = async () => {
      if (!alive) return;
      const v = videoRef.current;
      if (v && v.readyState >= 2 && !trainingRef.current) {
        const p = await ml.classify(ml.cropTo(v, cam.mirrored, scratch));
        if (alive && p) setProbs(Array.from(p));
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { alive = false; };
  }, [camState]);

  const top = probs.length ? probs.indexOf(Math.max(...probs)) : -1;

  return (
    <section ref={ref} className={`preview-card glass${ready ? ' ready' : ''}`} aria-label="Preview">
      <header className="panel-head">
        <h2 className="panel-title">Preview</h2>
        <button className="btn glass-btn sm" onClick={onExport} disabled={!ready}>
          <Icon name="download" size={16} /> Export
        </button>
      </header>

      {!ready ? (
        <div className="preview-empty">
          <div className="empty-orb"><Icon name="sparkle" size={26} /></div>
          <p>Train a model on the left and it will come alive here.</p>
        </div>
      ) : (
        <>
          <div className="input-row">
            <label className="switch">
              <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
              <span className="switch-track"><span className="switch-thumb" /></span>
              <span>Input</span>
            </label>
            <div className="segmented" role="radiogroup" aria-label="Input source">
              {(['webcam', 'file'] as const).map((s) => (
                <button key={s} role="radio" aria-checked={source === s} disabled={!on}
                  className={source === s ? 'on' : undefined} onClick={() => setSource(s)}>
                  {s === 'webcam' ? 'Webcam' : 'File'}
                </button>
              ))}
            </div>
          </div>

          {on && source === 'webcam' && (
            <div className="cam-wrap preview-cam">
              <video ref={videoRef} className="cam" autoPlay muted playsInline />
              {camState === 'starting' && <div className="cam-loading">Starting camera…</div>}
              <button className="icon-btn flip" aria-label="Switch camera" onClick={() => cam.flip().catch((e) => toast.error(errMsg(e)))}>
                <Icon name="flip" size={18} />
              </button>
            </div>
          )}
          {on && source === 'file' && <FileInput onProbs={setProbs} />}

          <div className="verdict">
            <span className="verdict-k">Looks like</span>
            <span className="verdict-v" style={{ color: top >= 0 ? colors[top] : undefined }}>
              {top >= 0 ? labels[top] : '—'}
            </span>
          </div>

          <div className="bars">
            {labels.map((label, i) => {
              const pct = Math.round((probs[i] ?? 0) * 100);
              return (
                <div key={i} className={`bar-row${i === top ? ' top' : ''}`} style={{ '--c': colors[i] } as CSSProperties}>
                  <span className="bar-label">{label}</span>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ transform: `scaleX(${pct / 100})` }} />
                  </div>
                  <span className="bar-pct">{pct}%</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
});

function FileInput({ onProbs }: { onProbs: (p: number[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const show = async (f?: File) => {
    if (!f) return;
    const u = URL.createObjectURL(f);
    try {
      const img = await loadImage(u);
      setUrl(u);
      const p = await ml.classify(ml.cropTo(img));
      if (p) onProbs(Array.from(p));
    } catch (e) {
      URL.revokeObjectURL(u);
      toast.error(errMsg(e));
    }
  };

  return (
    <button
      className={`drop-zone${dropping ? ' dropping' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDropping(true); }}
      onDragLeave={() => setDropping(false)}
      onDrop={(e) => { e.preventDefault(); setDropping(false); show(e.dataTransfer.files[0]); }}
    >
      {url ? <img src={url} alt="Image being classified" /> : (
        <span className="drop-hint"><Icon name="image" size={28} />Choose an image, or drop one here</span>
      )}
      <input ref={inputRef} type="file" accept="image/*" hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; show(f); }} />
    </button>
  );
}
