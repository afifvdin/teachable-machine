import { forwardRef } from 'react';
import type * as ml from '../ml';
import { Icon } from '../components/Icon';

export const DEFAULT_OPTIONS: ml.TrainOptions = { epochs: 50, batchSize: 16, learningRate: 0.001 };

type Props = {
  training: boolean;
  progress: ml.Progress | null;
  trained: boolean;
  stale: boolean;
  options: ml.TrainOptions;
  setOptions: (o: ml.TrainOptions) => void;
  onTrain: () => void;
};

const R = 54;
const CIRC = 2 * Math.PI * R;

export const TrainPanel = forwardRef<HTMLElement, Props>(function TrainPanel({ training, progress, trained, stale, options, setOptions, onTrain }, ref) {
  const ready = trained && !stale && !training;
  const frac = training ? (progress ? progress.epoch / progress.epochs : 0) : ready ? 1 : 0;
  const mode = training ? 'training' : ready ? 'ready' : stale ? 'stale' : 'idle';

  const setNum = (key: keyof ml.TrainOptions, raw: string) => {
    const v = Number(raw);
    if (Number.isFinite(v) && v > 0) setOptions({ ...options, [key]: v });
  };

  return (
    <section ref={ref} className={`train-card glass ${mode}`} aria-label="Training">
      <h2 className="panel-title">Training</h2>

      <div className="core" aria-live="polite">
        <div className="core-glow" />
        <svg viewBox="0 0 140 140" className="core-ring">
          <defs>
            <linearGradient id="train-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#c8b6ff" />
              <stop offset="1" stopColor="#ffd6a5" />
            </linearGradient>
          </defs>
          <circle cx="70" cy="70" r={R} className="ring-track" />
          <circle cx="70" cy="70" r={R} className="ring-fill" stroke="url(#train-ring)"
            strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - frac)} />
        </svg>
        <div className="core-center">
          {training ? (
            <>
              <span className="core-num">{progress?.epoch ?? 0}</span>
              <span className="core-sub">of {options.epochs} epochs</span>
            </>
          ) : ready ? (
            <>
              <Icon name="check" size={30} />
              <span className="core-sub">Model ready</span>
            </>
          ) : (
            <>
              <Icon name="sparkle" size={28} />
              <span className="core-sub">{stale ? 'Out of date' : 'Not trained'}</span>
            </>
          )}
        </div>
      </div>

      {training && progress && (
        <dl className="train-stats">
          <div><dt>Accuracy</dt><dd>{(progress.acc * 100).toFixed(0)}%</dd></div>
          <div><dt>Loss</dt><dd>{progress.loss.toFixed(3)}</dd></div>
        </dl>
      )}

      <button className={`btn wide ${training ? 'danger-soft' : ready ? 'glass-btn' : 'primary'}`} onClick={onTrain}>
        {training ? <><Icon name="stop" size={18} /> Stop</> : ready ? 'Retrain' : 'Train model'}
      </button>

      {!training && (
        <p className={`train-hint${stale ? ' warn' : ''}`}>
          {stale ? 'Samples changed. Train again to update.' : ready ? '' : 'Add samples to two or more classes, then train.'}
        </p>
      )}

      <details className="advanced">
        <summary>Advanced</summary>
        <label className="field">
          <span>Epochs</span>
          <input type="number" min={1} max={1000} step={1} value={options.epochs} onChange={(e) => setNum('epochs', e.target.value)} />
        </label>
        <label className="field">
          <span>Batch size</span>
          <select value={options.batchSize} onChange={(e) => setNum('batchSize', e.target.value)}>
            {[16, 32, 64, 128, 256, 512].map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Learning rate</span>
          <input type="number" min={0.00001} max={1} step={0.0001} value={options.learningRate} onChange={(e) => setNum('learningRate', e.target.value)} />
        </label>
        <button className="btn text sm" onClick={() => setOptions(DEFAULT_OPTIONS)}>Reset defaults</button>
      </details>
    </section>
  );
});
