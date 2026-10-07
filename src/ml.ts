import * as tf from '@tensorflow/tfjs';

export const IMAGE_SIZE = 224;
const BASE_URL = '/models/mobilenet/model.json';
const HIDDEN_UNITS = 100;

let features: tf.LayersModel | null = null;
let loading: Promise<tf.LayersModel> | null = null;
let head: tf.Sequential | null = null;
let fitting: tf.Sequential | null = null;

/** MobileNetV2 (α=0.35) without its top, pooled to a 1280-d embedding. */
export function loadBase() {
  loading ??= (async () => {
    await tf.ready();
    const base = await tf.loadLayersModel(BASE_URL);
    const pooled = tf.layers.globalAveragePooling2d({}).apply(base.outputs[0]) as tf.SymbolicTensor;
    features = tf.model({ inputs: base.inputs, outputs: pooled });
    // Warm up so the first real capture doesn't stall on shader compilation.
    tf.tidy(() => features!.predict(tf.zeros([1, IMAGE_SIZE, IMAGE_SIZE, 3])));
    return features;
  })().catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

type Source = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;

/** Center-crops any image source to a 224×224 canvas. */
export function cropTo(src: Source, mirror = false, out = document.createElement('canvas')) {
  const w = src instanceof HTMLVideoElement ? src.videoWidth : src instanceof HTMLImageElement ? src.naturalWidth : src.width;
  const ht = src instanceof HTMLVideoElement ? src.videoHeight : src instanceof HTMLImageElement ? src.naturalHeight : src.height;
  const s = Math.min(w, ht);
  if (out.width !== IMAGE_SIZE) out.width = out.height = IMAGE_SIZE;
  const ctx = out.getContext('2d', { willReadFrequently: true })!;
  ctx.save();
  if (mirror) {
    ctx.translate(IMAGE_SIZE, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(src, (w - s) / 2, (ht - s) / 2, s, s, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
  ctx.restore();
  return out;
}

const toInput = (c: HTMLCanvasElement) =>
  tf.browser.fromPixels(c).toFloat().div(127.5).sub(1).expandDims(0);

export async function embed(canvas: HTMLCanvasElement) {
  const m = await loadBase();
  const t = tf.tidy(() => m.predict(toInput(canvas)) as tf.Tensor);
  const data = (await t.data()) as Float32Array;
  t.dispose();
  return data;
}

export type TrainOptions = { epochs: number; batchSize: number; learningRate: number };
export type Progress = { epoch: number; epochs: number; loss: number; acc: number };

/** Trains a small dense head on the embeddings; data[i] holds the samples of class i. */
export async function train(data: Float32Array[][], o: TrainOptions, onProgress: (p: Progress) => void) {
  const items = data.flatMap((list, c) => list.map((e) => [e, c] as const));
  tf.util.shuffle(items);
  const dim = items[0][0].length;
  const xs = new Float32Array(items.length * dim);
  items.forEach(([e], i) => xs.set(e, i * dim));
  const x = tf.tensor2d(xs, [items.length, dim]);
  const y = tf.tidy(() => tf.oneHot(tf.tensor1d(items.map(([, c]) => c), 'int32'), data.length).toFloat());

  const model = tf.sequential({
    layers: [
      tf.layers.dense({ inputShape: [dim], units: HIDDEN_UNITS, activation: 'relu' }),
      tf.layers.dense({ units: data.length, activation: 'softmax' }),
    ],
  });
  model.compile({ optimizer: tf.train.adam(o.learningRate), loss: 'categoricalCrossentropy', metrics: ['accuracy'] });

  fitting = model;
  try {
    await model.fit(x, y, {
      epochs: o.epochs,
      batchSize: o.batchSize,
      shuffle: true,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          onProgress({ epoch: epoch + 1, epochs: o.epochs, loss: logs?.loss ?? 0, acc: logs?.acc ?? logs?.accuracy ?? 0 });
          // A timer yield (not rAF) keeps training going when the tab is in the background.
          await new Promise((r) => setTimeout(r));
        },
      },
    });
  } finally {
    fitting = null;
    x.dispose();
    y.dispose();
  }
  head?.dispose();
  head = model;
}

export function stopTraining() {
  if (fitting) fitting.stopTraining = true;
}

export const hasModel = () => head != null;

export function reset() {
  head?.dispose();
  head = null;
}

export async function classify(canvas: HTMLCanvasElement) {
  if (!head || !features) return null;
  const hd = head;
  const f = features;
  const t = tf.tidy(() => hd.predict(f.predict(toInput(canvas)) as tf.Tensor) as tf.Tensor);
  const data = (await t.data()) as Float32Array;
  t.dispose();
  return data;
}

/** Folds base + head into one standalone TF.js layers model (image in, probabilities out). */
export async function exportArtifacts(labels: string[]) {
  if (!head || !features) throw new Error('Train a model first');
  const d1 = tf.layers.dense({ units: HIDDEN_UNITS, activation: 'relu' });
  const d2 = tf.layers.dense({ units: labels.length, activation: 'softmax' });
  const out = d2.apply(d1.apply(features.outputs[0])) as tf.SymbolicTensor;
  const full = tf.model({ inputs: features.inputs, outputs: out });
  d1.setWeights(head.layers[0].getWeights());
  d2.setWeights(head.layers[1].getWeights());

  let art!: tf.io.ModelArtifacts;
  await full.save(
    tf.io.withSaveHandler(async (a) => {
      art = a;
      return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } };
    }),
  );
  const weights = Array.isArray(art.weightData) ? tf.io.concatenateArrayBuffers(art.weightData) : art.weightData!;
  const modelJson = {
    format: 'layers-model',
    generatedBy: `TensorFlow.js tfjs-layers v${tf.version.tfjs}`,
    convertedBy: null,
    modelTopology: art.modelTopology,
    weightsManifest: [{ paths: ['weights.bin'], weights: art.weightSpecs }],
  };
  const metadata = {
    tfjsVersion: tf.version.tfjs,
    modelName: 'teachable-machine-image-model',
    timeStamp: new Date().toISOString(),
    labels,
    imageSize: IMAGE_SIZE,
    normalization: '[-1, 1]',
  };
  return { modelJson, weights, metadata };
}
