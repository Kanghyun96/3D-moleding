import assert from 'node:assert/strict';
import { VehicleMotion } from '../motion.js';
import { HOME, P01_HOME } from '../routes.js';

console.log('Testing Concurrent Dual Equipment Driving & Return...');

const bobcat = new VehicleMotion({ slotId: 'P03' });
const dx55 = new VehicleMotion({ slotId: 'P01' });

// Verify initial positions
assert.equal(bobcat.x, HOME[0]);
assert.equal(bobcat.z, HOME[1]);
assert.equal(dx55.x, P01_HOME[0]);
assert.equal(dx55.z, P01_HOME[1]);
console.log('1. Both equipments parked at their own slots:');
console.log('   Bobcat at P03:', [bobcat.x.toFixed(2), bobcat.z.toFixed(2)]);
console.log('   DX-55 at P01: ', [dx55.x.toFixed(2), dx55.z.toFixed(2)]);

// Depart both concurrently!
bobcat.select('A');
dx55.select('B');

console.log('2. Departed:');
console.log('   Bobcat departing towards A via:', bobcat.travelEdges.map(e => e.from + '->' + e.to).join(', '));
console.log('   DX-55 departing towards B via:', dx55.travelEdges.map(e => e.from + '->' + e.to).join(', '));

assert.equal(bobcat.travelEdges[0].from, 'home');
assert.equal(dx55.travelEdges[0].from, 'home_P01');

// Simulate 500 steps of concurrent driving
for (let step = 0; step < 500; step++) {
  bobcat.update(1 / 60);
  dx55.update(1 / 60);
}

console.log('3. Concurrent driving status:');
console.log(`   Bobcat speed: ${(bobcat.speed * 3.6).toFixed(1)} km/h, dist: ${bobcat.distance.toFixed(1)}m, trackL: ${bobcat.leftDistance.toFixed(1)}m, trackR: ${bobcat.rightDistance.toFixed(1)}m`);
console.log(`   DX-55  speed: ${(dx55.speed * 3.6).toFixed(1)} km/h, dist: ${dx55.distance.toFixed(1)}m, trackL: ${dx55.leftDistance.toFixed(1)}m, trackR: ${dx55.rightDistance.toFixed(1)}m`);

assert.ok(bobcat.distance > 5, 'Bobcat should have driven forward');
assert.ok(dx55.distance > 5, 'DX-55 should have driven forward');
assert.ok(bobcat.leftDistance > 0, 'Bobcat left track should roll');
assert.ok(dx55.leftDistance > 0, 'DX-55 left track should roll');

// Distance between the two should be maintained (they don't overlap!)
const distBetween = Math.hypot(bobcat.x - dx55.x, bobcat.z - dx55.z);
console.log(`   Distance between the two vehicles: ${distBetween.toFixed(2)}m (no overlap!)`);
assert.ok(distBetween > 2.0, 'Vehicles must not overlap during independent driving');

console.log('\nAll concurrent driving & wheel motion tests passed 100%!');
