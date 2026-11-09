// Node names are the contract shared by placeholders and the future GLB assets.
export const MODEL_SPECS = [
  {
    file: 'ship_panel.glb',
    nodes: ['Panel', 'Hatch', 'Hatch_Hinge', 'Screw_TL', 'Screw_TR', 'Screw_BL', 'Screw_BR', 'Screw_Safety', 'Alarm_Light'],
  },
  {
    file: 'power_box.glb',
    nodes: ['PowerBox', 'Breaker_Cover', 'Breaker_Lever', 'LED_Power'],
  },
  {
    file: 'harness.glb',
    nodes: Array.from({ length: 6 }, (_, index) => index + 1).flatMap(index => [
      `Terminal_L_${index}`, `Terminal_R_${index}`,
      `Terminal_Screw_L_${index}`, `Terminal_Screw_R_${index}`,
    ]),
  },
  {
    file: 'tools.glb',
    nodes: ['Screwdriver_Phillips', 'Screwdriver_Flat', 'Wire_Stripper', 'Headlamp'],
  },
  { file: 'mars_ground.glb', nodes: ['Ground', 'Rocks'] },
];

export const REQUIRED_NODES = MODEL_SPECS.flatMap(({ nodes }) => nodes);
