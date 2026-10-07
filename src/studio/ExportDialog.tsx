import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Icon } from '../components/Icon';
import { packModel } from '../project';
import { download, errMsg } from '../util';

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

export function ExportDialog({ labels, onClose }: { labels: string[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const onDownload = async () => {
    setBusy(true);
    try {
      download(await packModel(labels), 'teachable-machine-model.zip');
      toast.success('Model downloaded');
    } catch (e) {
      toast.error(`Export failed: ${errMsg(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const onCopy = async () => {
    await navigator.clipboard.writeText(SNIPPET).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <dialog ref={ref} className="modal" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current.close()}>
      <div className="modal-inner">
        <header className="panel-head">
          <h2 className="modal-title">Export your <em>model</em></h2>
          <button className="icon-btn" aria-label="Close" onClick={() => ref.current?.close()}><Icon name="close" /></button>
        </header>
        <p>
          A standard TensorFlow.js layers model: <code>model.json</code>, <code>weights.bin</code> and{' '}
          <code>metadata.json</code> with your labels ({labels.join(', ')}). It takes a 224×224 image scaled to [-1, 1] and
          returns one probability per class.
        </p>
        <button className="btn primary" onClick={onDownload} disabled={busy}>
          <Icon name="download" size={18} /> {busy ? 'Packing…' : 'Download model'}
        </button>
        <div className="snippet-head">
          <h3>Use it on a web page</h3>
          <button className="btn text sm" onClick={onCopy}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
        <pre className="snippet"><code>{SNIPPET}</code></pre>
      </div>
    </dialog>
  );
}
