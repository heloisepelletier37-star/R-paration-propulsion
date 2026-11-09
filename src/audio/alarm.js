import * as THREE from 'three';

export function createAlarmAudio(camera, alarm) {
  let listener;
  let sound;
  let oscillator;
  let enabled = false;
  let requested = false;
  let alarmAudible = false;
  let lastEffect = null;
  return {
    async setEnabled(value) {
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
      enabled = requested;
      if (!enabled) sound.setVolume(0);
      return enabled;
    },
    ping() {
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
    },
    effect(kind) {
      if (!enabled || listener.context.state !== 'running') return;
      lastEffect = kind;
      const context = listener.context;
      const profile = {
        shock: [0.13, 'sawtooth', 2500, 140, 0.035], switch: [0.055, 'square', 180, 65, 0.06],
        screw: [0.06, 'triangle', 390, 190, 0.025], slip: [0.18, 'sawtooth', 1800, 320, 0.035],
        blocked: [0.08, 'triangle', 110, 55, 0.05], hatch: [0.12, 'square', 150, 50, 0.035],
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
      note.onended = () => { note.disconnect(); envelope.disconnect(); };
      note.start(); note.stop(context.currentTime + duration + 0.01);
    },
    update(elapsed, powered = true, alarmActive = true) {
      alarmAudible = enabled && powered && alarmActive && elapsed % 1 < 0.12;
      if (!sound) return;
      if (!powered || !alarmActive || !enabled) {
        // Electrical isolation must silence the alarm immediately, without the
        // short smoothing ramp used for its normal periodic beeps.
        const time = listener.context.currentTime;
        sound.gain.gain.cancelScheduledValues(time);
        sound.gain.gain.setValueAtTime(0, time);
      } else sound.setVolume(alarmAudible ? 0.045 : 0);
    },
    snapshot() { return { enabled, alarmAudible, volume: sound?.getVolume() ?? 0, lastEffect }; },
  };
}
