import * as THREE from 'three';

export function createAlarmAudio(camera, alarm, onUnavailable = () => {}) {
  let listener;
  let sound;
  let oscillator;
  let enabled = false;
  let requested = false;
  let alarmAudible = false;
  let lastEffect = null;
  let unavailable = false;
  const effects = new Set();

  function disable() {
    unavailable = true;
    enabled = false;
    requested = false;
    alarmAudible = false;
    try { sound?.setVolume(0); } catch { /* Audio may be forbidden by the host. */ }
    onUnavailable();
    return false;
  }

  // Audio is optional, including its synchronous setup, async resume and effects.
  // A partial/failed setup must not interrupt state updates or the render loop.
  const optional = action => (...args) => {
    if (unavailable) return false;
    try {
      const result = action(...args);
      return result instanceof Promise ? result.catch(disable) : result;
    } catch { return disable(); }
  };

  return {
    setEnabled: optional(async value => {
      requested = Boolean(value);
      if (!requested && !listener) return false;
      if (!listener) {
        listener = new THREE.AudioListener();
        camera.add(listener);
        sound = new THREE.PositionalAudio(listener);
        sound.setRefDistance(3);
        sound.setVolume(0);
        oscillator = listener.context.createOscillator();
        oscillator.frequency.value = 740;
        oscillator.type = 'sine';
        sound.setNodeSource(oscillator);
        alarm.add(sound);
        oscillator.start();
      }
      if (requested) await listener.context.resume();
      enabled = requested && listener.context.state === 'running';
      if (!enabled) {
        sound.setVolume(0);
        for (const effect of effects) { effect.envelope.gain.cancelScheduledValues(listener.context.currentTime); effect.envelope.gain.setValueAtTime(0, listener.context.currentTime); }
      }
      return enabled;
    }),
    ping: optional(() => {
      if (!enabled || listener.context.state !== 'running') return false;
      const context = listener.context;
      const note = context.createOscillator();
      const envelope = context.createGain();
      note.type = 'sine'; note.frequency.value = 880;
      envelope.gain.setValueAtTime(0, context.currentTime);
      envelope.gain.linearRampToValueAtTime(0.025, context.currentTime + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.09);
      note.connect(envelope); envelope.connect(listener.getInput());
      note.onended = () => { note.disconnect(); envelope.disconnect(); };
      note.start(); note.stop(context.currentTime + 0.1);
      return true;
    }),
    effect: optional(kind => {
      if (!enabled || listener.context.state !== 'running') return;
      lastEffect = kind;
      const context = listener.context;
      const profile = {
        shock: [0.13, 'sawtooth', 2500, 140, 0.035], switch: [0.055, 'square', 180, 65, 0.06],
        screw: [0.06, 'triangle', 390, 190, 0.025], slip: [0.18, 'sawtooth', 1800, 320, 0.035],
        blocked: [0.08, 'triangle', 110, 55, 0.05], hatch: [0.12, 'square', 150, 50, 0.035],
        startup: [2.2, 'sawtooth', 34, 145, 0.045],
      }[kind];
      if (!profile) return;
      const [duration, type, startFrequency, endFrequency, gain] = profile;
      const envelope = context.createGain();
      const note = context.createOscillator();
      note.type = type;
      note.frequency.setValueAtTime(startFrequency, context.currentTime);
      note.frequency.exponentialRampToValueAtTime(endFrequency, context.currentTime + duration);
      envelope.gain.setValueAtTime(0.0001, context.currentTime);
      envelope.gain.exponentialRampToValueAtTime(gain, context.currentTime + 0.005);
      envelope.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      note.connect(envelope); envelope.connect(listener.getInput());
      const effect = { note, envelope }; effects.add(effect);
      note.onended = () => { effects.delete(effect); note.disconnect(); envelope.disconnect(); };
      note.start(); note.stop(context.currentTime + duration + 0.01);
    }),
    update: optional((elapsed, powered = true, alarmActive = true) => {
      alarmAudible = enabled && powered && alarmActive && elapsed % 1 < 0.12;
      if (!sound) return;
      if (!powered || !alarmActive || !enabled) {
        // Electrical isolation must silence the alarm immediately, without the
        // short smoothing ramp used for its normal periodic beeps.
        const time = listener.context.currentTime;
        sound.gain.gain.cancelScheduledValues(time);
        sound.gain.gain.setValueAtTime(0, time);
      } else sound.setVolume(alarmAudible ? 0.045 : 0);
    }),
    stopEffects: optional(() => {
      for (const effect of effects) { effect.envelope.gain.cancelScheduledValues(listener.context.currentTime); effect.envelope.gain.setValueAtTime(0, listener.context.currentTime); effect.note.stop(); }
    }),
    snapshot() { return { enabled, alarmAudible, volume: unavailable ? 0 : sound?.getVolume() ?? 0, lastEffect }; },
  };
}
