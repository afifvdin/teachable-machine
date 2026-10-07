import { Icon, type IconName } from './Icon';
import { NetworkArt } from './NetworkArt';

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'webcam', title: 'Gather', text: 'Hold to record examples from your webcam, or drop in images. One class for each thing you want to tell apart.' },
  { icon: 'sparkle', title: 'Train', text: 'A pre-trained MobileNet does the heavy lifting, so a good model is ready in seconds, not hours.' },
  { icon: 'download', title: 'Export', text: 'Watch it predict live, then download a standard TensorFlow.js model for your own site or app.' },
];

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'lock', title: 'Private by design', text: 'Everything runs in your browser. Your images never touch a server.' },
  { icon: 'bolt', title: 'Seconds to train', text: 'Transfer learning on the GPU via WebGL. No setup, no waiting.' },
  { icon: 'code', title: 'Yours to keep', text: 'Export model.json + weights and use them anywhere TensorFlow.js runs.' },
];

export function Landing() {
  return (
    <main className="landing">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow reveal"><span className="pulse-dot" /> Image classification · no code</p>
          <h1 className="reveal">
            Teach a machine <em>to see</em> your world.
          </h1>
          <p className="lede reveal">
            Show it a few examples, train in seconds, and take the model with you. A playground for machine learning that
            lives entirely in your browser.
          </p>
          <div className="hero-cta reveal">
            <a className="btn primary lg" href="#/train">
              Start training <Icon name="arrow" size={18} />
            </a>
            <a className="btn glass-btn lg" href="https://github.com/afifvdin/teachable-machine" target="_blank" rel="noopener">
              <Icon name="github" size={18} /> Source
            </a>
          </div>
        </div>
        <div className="hero-art reveal">
          <NetworkArt />
        </div>
      </section>

      <ol className="steps">
        {STEPS.map((s, i) => (
          <li key={s.title} className="step glass" style={{ animationDelay: `${300 + i * 70}ms` }}>
            <div className="step-top">
              <span className="step-icon"><Icon name={s.icon} size={22} /></span>
              <span className="step-n">0{i + 1}</span>
            </div>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>

      <section className="features">
        {FEATURES.map((f) => (
          <div key={f.title} className="feature">
            <Icon name={f.icon} />
            <div>
              <h4>{f.title}</h4>
              <p>{f.text}</p>
            </div>
          </div>
        ))}
      </section>

      <footer className="foot">
        An open-source take on Google’s Teachable Machine, built by{' '}
        <a href="https://github.com/afifvdin" target="_blank" rel="noopener">@afifvdin</a>. Not affiliated with Google.
      </footer>
    </main>
  );
}
