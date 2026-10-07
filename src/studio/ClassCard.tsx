import { memo, useEffect, useRef, useState, type CSSProperties, type Dispatch } from 'react';
import { toast } from 'sonner';
import * as ml from '../ml';
import { Icon } from '../components/Icon';
import { Menu } from '../components/Menu';
import { cam, useCamera } from '../useCamera';
import { errMsg } from '../util';
import type { Action, Klass, Sample } from '../store';

const RECORD_FPS = 12;

type Props = {
  k: Klass;
  index: number;
  color: string;
  capturing: boolean;
  setCapturing: (id: number | null) => void;
  dispatch: Dispatch<Action>;
  addSample: (id: number, canvas: HTMLCanvasElement) => Promise<void>;
  addFiles: (id: number, files: File[]) => Promise<void>;
  register: (id: number, el: HTMLElement | null) => void;
};

export const ClassCard = memo(function ClassCard({ k, index, color, capturing, setCapturing, dispatch, addSample, addFiles, register }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dropping, setDropping] = useState(false);
  const n = k.samples.length;
  const thumbs = [...k.samples].reverse();

  const onDelete = () => {
    if (n && !confirm(`Delete “${k.name}” and its ${n} samples?`)) return;
    dispatch({ type: 'deleteClass', id: k.id });
  };

  return (
    <article
      ref={(el) => register(k.id, el)}
      className={`class-card glass${capturing ? ' capturing' : ''}${dropping ? ' dropping' : ''}`}
      style={{ '--c': color, animationDelay: `${index * 50}ms` } as CSSProperties}
      onDragOver={(e) => { e.preventDefault(); setDropping(true); }}
      onDragLeave={() => setDropping(false)}
      onDrop={(e) => { e.preventDefault(); setDropping(false); addFiles(k.id, [...e.dataTransfer.files]); }}
    >
      <header className="cc-head">
        <span className="cc-swatch" />
        <input
          className="cc-name"
          value={k.name}
          aria-label="Class name"
          spellCheck={false}
          onChange={(e) => dispatch({ type: 'rename', id: k.id, name: e.target.value })}
          onBlur={(e) => !e.target.value.trim() && dispatch({ type: 'rename', id: k.id, name: `Class ${index + 1}` })}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <Menu label={`Options for ${k.name}`} items={[
          { label: 'Clear samples', onSelect: () => dispatch({ type: 'clear', id: k.id }) },
          { label: 'Delete class', danger: true, onSelect: onDelete },
        ]} />
      </header>

      <div className="cc-body">
        {capturing && <Capture onSample={(c) => addSample(k.id, c)} onClose={() => setCapturing(null)} />}
        <div className="cc-samples">
          <p className="cc-count">
            {n ? <><b>{n}</b> image sample{n === 1 ? '' : 's'}</> : 'Add image samples'}
          </p>
          <div className="cc-row">
            {!capturing && (
              <div className="sources">
                <button className="source" onClick={() => setCapturing(k.id)}>
                  <Icon name="webcam" /> Webcam
                </button>
                <button className="source" onClick={() => fileRef.current?.click()}>
                  <Icon name="upload" /> Upload
                </button>
              </div>
            )}
            <div className="thumbs">
              {thumbs.map((s) => <Thumb key={s.id} s={s} onDelete={() => dispatch({ type: 'deleteSample', id: k.id, sampleId: s.id })} />)}
              {!n && !capturing && <span className="thumbs-hint">or drop images here</span>}
            </div>
          </div>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden
        onChange={(e) => { const files = [...(e.target.files ?? [])]; e.target.value = ''; addFiles(k.id, files); }} />
    </article>
  );
});

const Thumb = memo(function Thumb({ s, onDelete }: { s: Sample; onDelete: () => void }) {
  return (
    <div className="thumb">
      <img src={s.url} alt="" draggable={false} />
      <button className="thumb-del" aria-label="Delete sample" onClick={onDelete}><Icon name="close" size={16} /></button>
    </div>
  );
});

function Capture({ onSample, onClose }: { onSample: (c: HTMLCanvasElement) => Promise<void>; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const camState = useCamera(videoRef, true);
  const [recording, setRecording] = useState(false);
  const [captured, setCaptured] = useState(0);
  const sampleRef = useRef(onSample);
  sampleRef.current = onSample;

  useEffect(() => {
    if (camState === 'error') onClose();
  }, [camState, onClose]);

  useEffect(() => {
    if (!recording) return;
    let alive = true;
    (async () => {
      let last = 0;
      while (alive) {
        const v = videoRef.current;
        const now = performance.now();
        if (v && v.readyState >= 2 && now - last >= 1000 / RECORD_FPS) {
          last = now;
          await sampleRef.current(ml.cropTo(v, cam.mirrored));
          if (alive) setCaptured((c) => c + 1);
        }
        await new Promise(requestAnimationFrame);
      }
    })().catch((e) => toast.error(errMsg(e)));
    return () => { alive = false; };
  }, [recording]);

  const start = () => { setCaptured(0); setRecording(true); };
  const stop = () => setRecording(false);

  return (
    <div className="capture">
      <div className="capture-head">
        <span className={`live-dot${camState === 'live' ? ' on' : ''}`} /> Webcam
        <button className="icon-btn sm" aria-label="Close webcam" onClick={onClose}><Icon name="close" size={18} /></button>
      </div>
      <div className={`cam-wrap${recording ? ' rec' : ''}`}>
        <video ref={videoRef} className="cam" autoPlay muted playsInline />
        {camState === 'starting' && <div className="cam-loading">Starting camera…</div>}
        <button className="icon-btn flip" aria-label="Switch camera" onClick={() => cam.flip().catch((e) => toast.error(errMsg(e)))}>
          <Icon name="flip" size={18} />
        </button>
        {recording && <span className="rec-badge">● REC {captured}</span>}
      </div>
      <button
        className={`btn record${recording ? ' on' : ''}`}
        onPointerDown={(e) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch {} start(); }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); start(); } }}
        onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') stop(); }}
      >
        <span className="record-fill" />
        <span className="record-label">{recording ? 'Recording…' : 'Hold to record'}</span>
      </button>
    </div>
  );
}
