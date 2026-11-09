import * as THREE from 'three';

export function createAlarmAudio(camera, alarm) {
  let listener;
  let sound;
  let oscillator;
  let enabled = false;
  let requested = false;
  let alarmAudible = false;
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
      const context = listener.context;
      const duration = kind === 'shock' ? 0.13 : 0.055;
      const envelope = context.createGain();
      const note = context.createOscillator();
      note.type = kind === 'shock' ? 'sawtooth' : 'square';
      note.frequency.setValueAtTime(kind === 'shock' ? 2500 : 180, context.currentTime);
      note.frequency.exponentialRampToValueAtTime(kind === 'shock' ? 140 : 65, context.currentTime + duration);
      envelope.gain.setValueAtTime(0.0001, context.currentTime);
      envelope.gain.exponentialRampToValueAtTime(kind === 'shock' ? 0.035 : 0.06, context.currentTime + 0.005);
      envelope.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      note.connect(envelope); envelope.connect(listener.getInput());
      note.onended = () => { note.disconnect(); envelope.disconnect(); };
      note.start(); note.stop(context.currentTime + duration + 0.01);
    },
    update(elapsed, powered = true, alarmActive = true) {
      alarmAudible = enabled && powered && alarmActive && elapsed % 1 < 0.12;
      if (sound) sound.setVolume(alarmAudible ? 0.045 : 0);
    },
    snapshot() { return { enabled, alarmAudible, volume: sound?.getVolume() ?? 0 }; },
  };
}
