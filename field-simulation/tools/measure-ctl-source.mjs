import * as THREE from '../vendor/three.module.js';
import { buildBobcatCTLMesh } from '../ctl-source.js';

const faces = buildBobcatCTLMesh(0.1, 0);
const box = new THREE.Box3();
for (const f of faces) {
  for (const v of f.verts) {
    box.expandByPoint(new THREE.Vector3(v.x * 1.35, v.y * 1.35, v.z * 1.35));
  }
}
const size = new THREE.Vector3();
box.getSize(size);
console.log('Bobcat CTL Box (scaled 1.35):');
console.log('  min:', box.min);
console.log('  max:', box.max);
console.log('  size (X, Y, Z):', size);
