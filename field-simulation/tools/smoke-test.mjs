import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createFieldServer } from '../../server.mjs';

const root = resolve('.');
const dataFile = resolve('data/equipment.json');

const server = createFieldServer({ root, dataFile });
await new Promise(res => server.listen(0, '127.0.0.1', res));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
console.log(`Server started on ${base}`);

try {
  // 1. Root index.html
  const resRoot = await fetch(base + '/');
  assert.equal(resRoot.status, 200);
  assert.equal(resRoot.headers.get('content-type'), 'text/html; charset=utf-8');
  console.log('GET / -> 200 OK');

  // 2. Field simulation index.html
  const resField = await fetch(base + '/field-simulation/index.html');
  assert.equal(resField.status, 200);
  const fieldHtml = await resField.text();
  assert.ok(fieldHtml.includes('dx-55'), 'field-simulation/index.html should include dx-55 option');
  console.log('GET /field-simulation/index.html -> 200 OK (dx-55 option found)');

  // 3. preview_dx55.html
  const resPreview = await fetch(base + '/preview_dx55.html');
  assert.equal(resPreview.status, 200);
  console.log('GET /preview_dx55.html -> 200 OK');

  // 4. API equipment list
  const resApi = await fetch(base + '/api/equipment');
  assert.equal(resApi.status, 200);
  const data = await resApi.json();
  assert.equal(data.equipment.length, 2);
  const ids = data.equipment.map(e => e.id);
  assert.ok(ids.includes('bobcat-t870'));
  assert.ok(ids.includes('dx-55'));
  console.log('GET /api/equipment -> 200 OK (2 equipments registered: ' + ids.join(', ') + ')');

  // 5. API get dx-55
  const resDX55 = await fetch(base + '/api/equipment/dx-55');
  assert.equal(resDX55.status, 200);
  const dx55 = await resDX55.json();
  assert.equal(dx55.id, 'dx-55');
  assert.equal(dx55.parkingSlotId, 'P01');
  console.log('GET /api/equipment/dx-55 -> 200 OK (name: ' + dx55.name + ', slot: ' + dx55.parkingSlotId + ')');

  // 6. Vendor GLTFLoader.js
  const resLoader = await fetch(base + '/field-simulation/vendor/GLTFLoader.js');
  assert.equal(resLoader.status, 200);
  assert.equal(resLoader.headers.get('content-type'), 'text/javascript; charset=utf-8');
  console.log('GET /field-simulation/vendor/GLTFLoader.js -> 200 OK');

  // 7. GLB model file header check (HEAD request)
  const resGlb = await fetch(base + '/picture/DX-55.glb', { method: 'HEAD' });
  assert.equal(resGlb.status, 200);
  assert.equal(resGlb.headers.get('content-type'), 'model/gltf-binary');
  const len = parseInt(resGlb.headers.get('content-length') || '0', 10);
  assert.ok(len > 80000000, 'GLB file size should be > 80MB, got: ' + len);
  console.log(`HEAD /picture/DX-55.glb -> 200 OK (type: ${resGlb.headers.get('content-type')}, length: ${(len / 1024 / 1024).toFixed(1)} MB)`);

  console.log('\nAll 7 server & API smoke checks passed successfully!');
} finally {
  server.closeAllConnections();
  await new Promise(res => server.close(res));
  console.log('Server closed.');
}
