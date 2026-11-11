import {useCallback, useEffect, useState} from 'react';

export function useStepPlayer(
  stepCount: number,
  intervalMs: number,
  reducedMotion: boolean,
) {
  const last = stepCount - 1;
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (step >= last) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => setStep((s) => Math.min(s + 1, last)), intervalMs);
    return () => window.clearTimeout(id);
  }, [playing, step, last, intervalMs]);

  const play = useCallback(() => {
    if (reducedMotion) {
      setPlaying(false);
      setStep(step >= last ? 0 : last);
      return;
    }
    if (step >= last) setStep(0);
    setPlaying(true);
  }, [reducedMotion, step, last]);

  const pause = useCallback(() => setPlaying(false), []);

  const next = useCallback(() => {
    setPlaying(false);
    setStep((s) => Math.min(s + 1, last));
  }, [last]);

  const reset = useCallback(() => {
    setPlaying(false);
    setStep(0);
  }, []);

  return {step, done: step >= last, playing, play, pause, next, reset};
}
