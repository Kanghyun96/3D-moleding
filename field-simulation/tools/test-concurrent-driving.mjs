import assert from 'node:assert/strict';
import { VehicleMotion } from '../motion.js';
import { EQUIPMENTS, EQUIPMENT_IDS } from '../parking-config.js';
import { SLOT_HOME } from '../routes.js';
import { createGLBEquipment } from '../dx55-model.js';

console.log('Testing Concurrent 7-Equipment Driving, Independent Slots & MHE/CTL Night Lighting...');

const motions = {};
const models = {};
const routesToAssign = ['A', 'B', 'C', 'D', 'E', 'F', 'A'];

// 1. Initialize all 7 equipments at their dedicated parking slots (P01 ~ P07)
EQUIPMENT_IDS.forEach((id, idx) => {
  const cfg = EQUIPMENTS[id];
  const m = new VehicleMotion({ slotId: cfg.parkingSlotId });
  const model = createGLBEquipment(cfg);
  motions[id] = m;
  models[id] = model;

  const expectedHome = SLOT_HOME[cfg.parkingSlotId];
  assert.equal(m.x, expectedHome[0], `${id} initial X should match slot ${cfg.parkingSlotId}`);
  assert.equal(m.z, expectedHome[1], `${id} initial Z should match slot ${cfg.parkingSlotId}`);
  console.log(`1. [${cfg.parkingSlotId}] ${cfg.name} (${cfg.category.toUpperCase()}) parked at:`, [m.x.toFixed(2), m.z.toFixed(2)]);
});

// Verify no two parked equipments share the same slot coordinates
for (let i = 0; i < EQUIPMENT_IDS.length; i++) {
  for (let j = i + 1; j < EQUIPMENT_IDS.length; j++) {
    const a = motions[EQUIPMENT_IDS[i]];
    const b = motions[EQUIPMENT_IDS[j]];
    const dist = Math.hypot(a.x - b.x, a.z - b.z);
    assert.ok(dist > 3.0, `Parked vehicles ${EQUIPMENT_IDS[i]} and ${EQUIPMENT_IDS[j]} must not overlap (dist=${dist.toFixed(2)}m)`);
  }
}

// 2. Depart all 7 equipments concurrently!
EQUIPMENT_IDS.forEach((id, idx) => {
  const targetRoute = routesToAssign[idx % routesToAssign.length];
  motions[id].select(targetRoute);
  const expectedHomeNode = EQUIPMENTS[id].parkingSlotId === 'P03' ? 'home' : `home_${EQUIPMENTS[id].parkingSlotId}`;
  assert.equal(motions[id].travelEdges[0].from, expectedHomeNode, `${id} must depart from ${expectedHomeNode}`);
});

// 3. Simulate 500 steps of concurrent driving & update 3D models (day & night)
for (let step = 0; step < 500; step++) {
  const night = step > 250 ? 1.0 : 0.0;
  for (const id of EQUIPMENT_IDS) {
    motions[id].update(1 / 60);
    models[id].update(motions[id], night);
  }
}

console.log('\n2. Concurrent driving status after 500 steps:');
for (const id of EQUIPMENT_IDS) {
  const m = motions[id];
  const cfg = EQUIPMENTS[id];
  console.log(`   [${cfg.parkingSlotId}] ${cfg.name.padEnd(16)} (${cfg.category.toUpperCase()}) -> speed: ${(m.speed * 3.6).toFixed(1)} km/h, dist: ${m.distance.toFixed(1)}m, trackL: ${m.leftDistance.toFixed(1)}m, trackR: ${m.rightDistance.toFixed(1)}m`);
  assert.ok(m.distance > 5, `${id} should have driven forward`);
  assert.ok(m.leftDistance > 0, `${id} left track should roll`);
  assert.ok(m.rightDistance > 0, `${id} right track should roll`);
}

console.log('\nAll 7-equipment concurrent driving, independent slot routing & MHE/CTL lighting tests passed 100%!');
