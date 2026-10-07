# Teachable Machine

Train an image classifier in your browser, no code needed. An open-source take on Google's [Teachable Machine](https://teachablemachine.withgoogle.com/) (not affiliated with Google).

**Live:** https://teachablemachine.afifvdin.com

## How it works

1. **Gather**: add classes and record samples with your webcam (hold to record) or upload/drag in images.
2. **Train**: each sample is passed through a pre-trained MobileNetV2 (α 0.35) to get a 1280-d embedding. A small dense head (100 ReLU → softmax) is trained on those embeddings, so training takes seconds.
3. **Preview & export**: test the model live from the webcam or a file, then download a standalone TensorFlow.js layers model (`model.json`, `weights.bin`, `metadata.json`).

Built with React + Vite. Everything runs on-device with TensorFlow.js. Images never leave the browser. Projects can be saved to and opened from a `.zip` file.

## Development

```bash
npm install
npm run dev
```

## Deploy

Hosted on Cloudflare Workers static assets (see `wrangler.jsonc`):

```bash
npm run deploy
```

The base MobileNet weights are self-hosted under `public/models/mobilenet`.
