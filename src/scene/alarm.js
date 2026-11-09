export function isAlarmOn(elapsed) {
  return Math.floor(elapsed * 2) % 2 === 0;
}

export function updateAlarm(node, elapsed, active = true) {
  const on = active && isAlarmOn(elapsed);
  node.traverse(child => {
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (material?.name === 'M_Alarm') material.emissiveIntensity = on ? 3.2 : active ? 0.08 : 0;
    }
  });
  return on;
}
