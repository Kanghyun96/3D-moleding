import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

// Polyfill minimal browser objects for GLTFLoader.parse in Node
globalThis.self = globalThis;

const glbBuffer = readFileSync(resolve('picture/DX-55.glb'));
const arrayBuffer = glbBuffer.buffer.slice(glbBuffer.byteOffset, glbBuffer.byteOffset + glbBuffer.byteLength);

const loader = new GLTFLoader();
loader.parse(arrayBuffer, '', (gltf) => {
  const scene = gltf.scene;
  console.log('Scene parsed successfully!');
  
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  
  console.log('Original Bounding Box:');
  console.log('  min:', box.min);
  console.log('  max:', box.max);
  console.log('  size (X, Y, Z):', size);
  console.log('  center:', center);

  let meshCount = 0;
  let triangleCount = 0;
  scene.traverse((obj) => {
    if (obj.isMesh) {
      meshCount++;
      const geo = obj.geometry;
      if (geo.index) {
        triangleCount += geo.index.count / 3;
      } else if (geo.attributes.position) {
        triangleCount += geo.attributes.position.count / 3;
      }
      console.log('Mesh found:', obj.name, 'Geometry attributes:', Object.keys(geo.attributes));
      if (obj.material) {
        console.log('Material:', obj.material.type, 'map:', !!obj.material.map);
      }
    }
  });
  console.log(`Total meshes: ${meshCount}, triangles: ${triangleCount}`);
}, (err) => {
  console.error('Parse error:', err);
});
