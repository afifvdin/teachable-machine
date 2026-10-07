import JSZip from 'jszip';
import { exportArtifacts, type TrainOptions } from './ml';

type SavedClass = { name: string; samples: { url: string }[] };

export async function packProject(classes: SavedClass[], options: TrainOptions) {
  const zip = new JSZip();
  const manifest = {
    app: 'teachable-machine',
    version: 1,
    options,
    classes: classes.map((k, ci) => ({
      name: k.name,
      samples: k.samples.map((s, i) => {
        const path = `samples/${ci}/${i}.jpg`;
        zip.file(path, s.url.slice(s.url.indexOf(',') + 1), { base64: true });
        return path;
      }),
    })),
  };
  zip.file('project.json', JSON.stringify(manifest, null, 2));
  return zip.generateAsync({ type: 'blob' });
}

export async function unpackProject(file: Blob) {
  const zip = await JSZip.loadAsync(file);
  const raw = zip.file('project.json');
  if (!raw) throw new Error('Not a Teachable Machine project file');
  const m = JSON.parse(await raw.async('string')) as { options?: TrainOptions; classes: { name: string; samples: string[] }[] };
  const classes = await Promise.all(
    m.classes.map(async (k) => ({
      name: k.name,
      urls: await Promise.all(
        k.samples.map(async (p) => 'data:image/jpeg;base64,' + (await zip.file(p)!.async('base64'))),
      ),
    })),
  );
  return { options: m.options, classes };
}

export async function packModel(labels: string[]) {
  const { modelJson, weights, metadata } = await exportArtifacts(labels);
  const zip = new JSZip();
  zip.file('model.json', JSON.stringify(modelJson));
  zip.file('weights.bin', weights);
  zip.file('metadata.json', JSON.stringify(metadata, null, 2));
  return zip.generateAsync({ type: 'blob' });
}
