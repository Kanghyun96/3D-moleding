import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const vendorDir = resolve('field-simulation/vendor');
const jsmDir = resolve(vendorDir, 'package/examples/jsm');

// 1. Copy BufferGeometryUtils.js and SkeletonUtils.js
let bgu = readFileSync(resolve(jsmDir, 'utils/BufferGeometryUtils.js'), 'utf8');
bgu = bgu.replace(/from\s+['"]three['"]/g, "from '../three.module.js'");
mkdirSync(resolve(vendorDir, 'utils'), { recursive: true });
writeFileSync(resolve(vendorDir, 'utils/BufferGeometryUtils.js'), bgu, 'utf8');

let sku = readFileSync(resolve(jsmDir, 'utils/SkeletonUtils.js'), 'utf8');
sku = sku.replace(/from\s+['"]three['"]/g, "from '../three.module.js'");
writeFileSync(resolve(vendorDir, 'utils/SkeletonUtils.js'), sku, 'utf8');

// 2. Prepare GLTFLoader.js
let gltf = readFileSync(resolve(jsmDir, 'loaders/GLTFLoader.js'), 'utf8');
gltf = gltf.replace(/from\s+['"]three['"]/g, "from './three.module.js'");
gltf = gltf.replace(/from\s+['"]\.\.\/utils\/BufferGeometryUtils\.js['"]/g, "from './utils/BufferGeometryUtils.js'");
gltf = gltf.replace(/from\s+['"]\.\.\/utils\/SkeletonUtils\.js['"]/g, "from './utils/SkeletonUtils.js'");

writeFileSync(resolve(vendorDir, 'GLTFLoader.js'), gltf, 'utf8');
console.log('GLTFLoader and utils configured successfully!');
