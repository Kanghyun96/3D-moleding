import assert from 'node:assert/strict';
import { VehicleMotion } from '../motion.js';
import { HOME, P01_HOME } from '../routes.js';

// 1. Bobcat motion (P03)
const bobcat = new VehicleMotion({ slotId: 'P03' });
assert.equal(bobcat.slotId, 'P03');
assert.equal(bobcat.x, HOME[0]);
assert.equal(bobcat.z, HOME[1]);
assert.equal(bobcat.phase, 'parked');
console.log('Bobcat initialized at P03:', [bobcat.x.toFixed(2), bobcat.z.toFixed(2)]);

// 2. DX-55 motion (P01)
const dx55 = new VehicleMotion({ slotId: 'P01' });
assert.equal(dx55.slotId, 'P01');
assert.equal(dx55.x, P01_HOME[0]);
assert.equal(dx55.z, P01_HOME[1]);
assert.equal(dx55.phase, 'parked');
console.log('DX-55 initialized at P01:', [dx55.x.toFixed(2), dx55.z.toFixed(2)]);

// Ensure they do NOT share position
assert.notEqual(bobcat.x, dx55.x);
assert.notEqual(bobcat.z, dx55.z);

// 3. Test depart from P01
dx55.select('A');
assert.equal(dx55.destination, 'A');
assert.equal(dx55.phase, 'entry');
assert.ok(dx55.travelEdges.length > 0);
assert.equal(dx55.travelEdges[0].from, 'home_P01');
console.log('DX-55 departing from home_P01 successfully!');

// Simulate some steps
for (let i = 0; i < 200; i++) {
  dx55.update(1 / 60);
}
console.log('DX-55 moving along path, current speed:', dx55.speed.toFixed(2), 'distance:', dx55.distance.toFixed(2));
assert.ok(dx55.distance > 0);

console.log('All VehicleMotion slot tests passed 100%!');
