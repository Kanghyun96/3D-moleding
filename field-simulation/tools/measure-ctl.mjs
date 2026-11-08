import * as THREE from '../vendor/three.module.js';
import { createCTL } from '../ctl-model.js';

const ctl = createCTL();
const box = new THREE.Box3().setFromObject(ctl.root);
const size = new THREE.Vector3();
const center = new THREE.Vector3();
box.getSize(size);
box.getCenter(center);

console.log('Bobcat CTL Bounding Box (scale 1.35):');
console.log('  min:', box.min);
console.log('  max:', box.max);
console.log('  size (X, Y, Z):', size);
console.log('  center:', center);
