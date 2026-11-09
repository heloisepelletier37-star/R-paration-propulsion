import * as THREE from 'three';

export function createAlarmAudio(camera, alarm) {
  let listener;
  let sound;
  let oscillator;
  let enabled = false;
  return {
    async toggle() {
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
      await listener.context.resume();
      enabled = !enabled;
      if (!enabled) sound.setVolume(0);
      return enabled;
    },
    update(elapsed) {
      if (enabled) sound.setVolume(elapsed % 1 < 0.12 ? 0.045 : 0);
    },
  };
}
