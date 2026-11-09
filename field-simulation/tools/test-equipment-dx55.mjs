import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { initialEquipment, applyEquipmentPatch } from '../equipment-schema.js';
import { createEquipmentStore } from '../equipment-store.mjs';

const store = createEquipmentStore(resolve('data/equipment.json'));
const list = await store.list();
console.log('Equipment list:', list.map(e => ({ id: e.id, name: e.name, slot: e.parkingSlotId })));

assert.equal(list.length, 7, 'Should have 7 equipments registered');
const bobcat = await store.get('bobcat-t870');
assert.equal(bobcat.id, 'bobcat-t870');
assert.equal(bobcat.parkingSlotId, 'P03');

const dx55 = await store.get('dx-55');
assert.equal(dx55.id, 'dx-55');
assert.equal(dx55.parkingSlotId, 'P01');

// Test patching DX-55
const patched = await store.patch('dx-55', {
  purpose: 'Doosan DX-55 굴착 성능 및 선회 모션 필드 검증',
  testHours: 12.5,
  testStatus: 'running',
  tracks: { left: '굴착기 고무궤도 400mm A', right: '굴착기 고무궤도 400mm B' },
  surfaceHours: { general: 5.0, gravel: 4.5, concrete: 3.0 }
}, dx55.revision);

console.log('Successfully patched DX-55:', {
  id: patched.id,
  revision: patched.revision,
  purpose: patched.purpose,
  hours: patched.testHours,
  status: patched.testStatus
});

// Restore original testHours to 0
await store.patch('dx-55', {
  purpose: '5.5톤 소형 굴착기 필드 주행 및 선회 성능 시험',
  testHours: 0,
  testStatus: 'waiting',
  tracks: { left: '고무 궤도 400mm', right: '고무 궤도 400mm' },
  surfaceHours: { general: 0, gravel: 0, concrete: 0 }
}, patched.revision);

console.log('DX-55 equipment store test passed 100%!');
