import { useEffect, useState, type RefObject } from 'react';
import { toast } from 'sonner';
import { Webcam } from './webcam';
import { errMsg } from './util';

export const cam = new Webcam();

/** Streams the shared webcam into `ref` while `enabled`. */
export function useCamera(ref: RefObject<HTMLVideoElement | null>, enabled: boolean) {
  const [state, setState] = useState<'idle' | 'starting' | 'live' | 'error'>('idle');
  useEffect(() => {
    const v = ref.current;
    if (!enabled || !v) return setState('idle');
    let cancelled = false;
    setState('starting');
    cam
      .attach(v)
      .then(() => !cancelled && setState('live'))
      .catch((e) => {
        if (cancelled) return;
        setState('error');
        toast.error(`Camera unavailable: ${errMsg(e)}`);
      });
    return () => {
      cancelled = true;
      cam.detach(v);
    };
  }, [enabled, ref]);
  return state;
}
