import { lazy, Suspense, useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { Landing } from './components/Landing';
import { Icon, Logo } from './components/Icon';

// TensorFlow.js is only needed in the studio, so keep it out of the landing bundle.
const Studio = lazy(() => import('./studio/Studio').then((m) => ({ default: m.Studio })));

const readRoute = () => (location.hash.startsWith('#/train') ? 'train' : 'home');

export function App() {
  const [route, setRoute] = useState(readRoute);
  // Studio stays mounted once opened so samples survive a trip to the landing page.
  const [studioOpened, setStudioOpened] = useState(route === 'train');

  useEffect(() => {
    const onHash = () => {
      const r = readRoute();
      setRoute(r);
      if (r === 'train') setStudioOpened(true);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    document.title = route === 'train' ? 'Train · Teachable Machine' : 'Teachable Machine';
  }, [route]);

  return (
    <>
      <div className="backdrop" aria-hidden="true">
        <div className="aurora a1" />
        <div className="aurora a2" />
        <div className="aurora a3" />
        <div className="grid-lines" />
        <div className="grain" />
      </div>
      <header className="topbar">
        <a className="brand" href="#/">
          <Logo />
          <span>Teachable <em>Machine</em></span>
        </a>
        <nav className="top-nav">
          {route === 'home' ? (
            <a className="btn glass-btn sm" href="#/train">Open studio <Icon name="arrow" size={16} /></a>
          ) : (
            <a className="top-link" href="https://github.com/afifvdin/teachable-machine" target="_blank" rel="noopener" aria-label="Source on GitHub">
              <Icon name="github" />
            </a>
          )}
        </nav>
      </header>
      {route === 'home' && <Landing />}
      {studioOpened && (
        <Suspense fallback={<div className="studio-loading"><span className="live-dot on" /> Loading studio…</div>}>
          <Studio active={route === 'train'} />
        </Suspense>
      )}
      <Toaster theme="dark" position="bottom-center" toastOptions={{ className: 'toast' }} />
    </>
  );
}
