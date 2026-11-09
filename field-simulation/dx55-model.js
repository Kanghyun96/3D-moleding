import * as T from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { EQUIPMENTS } from './parking-config.js';

export const DX55_SCALE = 1.95;
export const DX55_BASE_YAW = Math.PI / 2; // -X in raw mesh aligns to +Z forward
export const DX55_GROUND_OFFSET = 0.738; // Grounded flush with terrain to eliminate hovering

// Default DX-55 track loop geometry (local units; scale 1.95 applies to root)
const R_TRACK = 0.105;
const Z_FRONT = 0.18;
const Z_REAR = -0.62;
const LEN_STRAIGHT = Z_FRONT - Z_REAR; // 0.80
const LEN_ARC = Math.PI * R_TRACK; // ~0.3299
export const DX55_TRACK_LENGTH = 2 * LEN_STRAIGHT + 2 * LEN_ARC;

export function computeTrackLoop({ zFront = Z_FRONT, zRear = Z_REAR, rTrack = R_TRACK, yBot = 0.010 } = {}) {
  const yMid = yBot + rTrack;
  const yTop = yBot + 2 * rTrack;
  const lenStraight = zFront - zRear;
  const lenArc = Math.PI * rTrack;
  const trackLength = 2 * lenStraight + 2 * lenArc;

  function pointAt(distance) {
    let d = ((distance % trackLength) + trackLength) % trackLength;
    // 1. Bottom straight: rear to front
    if (d <= lenStraight) {
      const t = d / lenStraight;
      return { y: yBot, z: zRear + t * lenStraight, angle: 0 };
    }
    d -= lenStraight;
    // 2. Front idler curve: bottom to top
    if (d <= lenArc) {
      const t = d / lenArc;
      const phi = -Math.PI / 2 + t * Math.PI;
      return {
        y: yMid + rTrack * Math.sin(phi),
        z: zFront + rTrack * Math.cos(phi),
        angle: -t * Math.PI,
      };
    }
    d -= lenArc;
    // 3. Top straight: front to rear
    if (d <= lenStraight) {
      const t = d / lenStraight;
      return { y: yTop, z: zFront - t * lenStraight, angle: -Math.PI };
    }
    d -= lenStraight;
    // 4. Rear drive sprocket curve: top to bottom
    const t = d / lenArc;
    const phi = Math.PI / 2 + t * Math.PI;
    return {
      y: yMid + rTrack * Math.sin(phi),
      z: zRear + rTrack * Math.cos(phi),
      angle: -Math.PI - t * Math.PI,
    };
  }

  return { yBot, yMid, yTop, zFront, zRear, rTrack, lenStraight, lenArc, trackLength, pointAt };
}

let sharedShadowTex = null;
function getContactShadowTexture() {
  if (typeof document === 'undefined') return null;
  if (sharedShadowTex) return sharedShadowTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 512);

  const grad = ctx.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, 'rgba(8, 10, 8, 0)');
  grad.addColorStop(0.18, 'rgba(8, 10, 8, 0.72)');
  grad.addColorStop(0.5, 'rgba(5, 7, 5, 0.96)');
  grad.addColorStop(0.82, 'rgba(8, 10, 8, 0.72)');
  grad.addColorStop(1, 'rgba(8, 10, 8, 0)');

  ctx.fillStyle = grad;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(8, 16, 112, 480, 28);
    ctx.fill();
  } else {
    ctx.fillRect(8, 16, 112, 480);
  }

  sharedShadowTex = new T.CanvasTexture(canvas);
  sharedShadowTex.colorSpace = T.SRGBColorSpace;
  return sharedShadowTex;
}

let sharedMHEPoolTex = null;
function getMHEHeadlightPoolTexture() {
  if (typeof document === 'undefined') return null;
  if (sharedMHEPoolTex) return sharedMHEPoolTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);

  // Compact, soft forward oval for MHE (Excavators)
  const grad = ctx.createRadialGradient(128, 190, 15, 128, 115, 115);
  grad.addColorStop(0, 'rgba(255, 244, 200, 0.72)');
  grad.addColorStop(0.30, 'rgba(255, 232, 165, 0.44)');
  grad.addColorStop(0.60, 'rgba(255, 215, 130, 0.18)');
  grad.addColorStop(0.85, 'rgba(240, 195, 100, 0.05)');
  grad.addColorStop(1.0, 'rgba(200, 170, 80, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(128, 128, 95, 120, 0, 0, Math.PI * 2);
  ctx.fill();

  sharedMHEPoolTex = new T.CanvasTexture(canvas);
  sharedMHEPoolTex.colorSpace = T.SRGBColorSpace;
  return sharedMHEPoolTex;
}

let sharedCTLPoolTex = null;
export function getCTLHeadlightPoolTexture() {
  if (typeof document === 'undefined') return null;
  if (sharedCTLPoolTex) return sharedCTLPoolTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);

  // Wide, soft forward beam covering the entire front width of the CTL bucket
  const grad = ctx.createRadialGradient(128, 190, 15, 128, 130, 120);
  grad.addColorStop(0, 'rgba(255, 246, 205, 0.76)');
  grad.addColorStop(0.32, 'rgba(255, 234, 165, 0.46)');
  grad.addColorStop(0.62, 'rgba(255, 215, 130, 0.18)');
  grad.addColorStop(0.85, 'rgba(240, 195, 100, 0.05)');
  grad.addColorStop(1.0, 'rgba(200, 170, 80, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(128, 135, 118, 105, 0, 0, Math.PI * 2);
  ctx.fill();

  sharedCTLPoolTex = new T.CanvasTexture(canvas);
  sharedCTLPoolTex.colorSpace = T.SRGBColorSpace;
  return sharedCTLPoolTex;
}

let sharedCTLFlareTex = null;
export function getCTLHeadlightFlareTexture() {
  if (typeof document === 'undefined') return null;
  if (sharedCTLFlareTex) return sharedCTLFlareTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);

  const grad = ctx.createRadialGradient(64, 64, 3, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.18, 'rgba(255, 250, 225, 0.92)');
  grad.addColorStop(0.38, 'rgba(255, 225, 145, 0.45)');
  grad.addColorStop(0.70, 'rgba(255, 195, 85, 0.12)');
  grad.addColorStop(1.0, 'rgba(255, 170, 40, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(64, 64, 62, 0, Math.PI * 2);
  ctx.fill();

  sharedCTLFlareTex = new T.CanvasTexture(canvas);
  sharedCTLFlareTex.colorSpace = T.SRGBColorSpace;
  return sharedCTLFlareTex;
}

// Sequential background loader queue so 7 high-poly GLB assets load smoothly
let loadChain = Promise.resolve();
function enqueueLoad(task) {
  const next = loadChain.then(task, task);
  loadChain = next.catch(() => {});
  return next;
}

/**
 * Creates a 3D GLB equipment instance with full crawler undercarriage mechanics,
 * contact ambient occlusion shadows, inertial suspension dynamics, and
 * category-specific night illumination (MHE vs CTL).
 */
export function createGLBEquipment(config = EQUIPMENTS['dx-55'], { glbUrl } = {}) {
  const scale = config.scale ?? DX55_SCALE;
  const baseYaw = config.baseYaw ?? DX55_BASE_YAW;
  const groundOffset = config.groundOffset ?? DX55_GROUND_OFFSET;
  const trackX = config.trackX ?? 0.366;
  const shoeWidth = config.shoeWidth ?? 0.118;
  const isCTL = config.category === 'ctl';
  const glbFile = config.glbFile || 'DX-55.glb';

  const loop = computeTrackLoop({
    zFront: config.zFront ?? Z_FRONT,
    zRear: config.zRear ?? Z_REAR,
    rTrack: config.rTrack ?? R_TRACK,
    yBot: 0.010,
  });

  const root = new T.Group();
  root.name = config.name || 'Equipment';
  root.scale.setScalar(scale);

  const pitchFrame = new T.Group();
  root.add(pitchFrame);

  const trackLeft = new T.Group();
  trackLeft.name = `${config.id}-Track-Left`;
  const trackRight = new T.Group();
  trackRight.name = `${config.id}-Track-Right`;
  pitchFrame.add(trackLeft, trackRight);

  const meshHolder = new T.Group();
  meshHolder.rotation.y = baseYaw;
  meshHolder.position.y = groundOffset;
  pitchFrame.add(meshHolder);

  // Fast invisible raycast proxy so pointer hover/click never traverses 4.5M triangles
  const pickGeo = new T.BoxGeometry(trackX * 2.5, groundOffset * 1.9, (loop.zFront - loop.zRear) * 1.45);
  const pickMat = new T.MeshBasicMaterial({ visible: false });
  const pickBox = new T.Mesh(pickGeo, pickMat);
  pickBox.position.set(0, groundOffset * 0.9, 0);
  root.add(pickBox);

  // Lightweight directional shadow proxy inside pitchFrame (avoids rendering 28M triangles in shadow pass)
  const shadowCasterGeo = new T.BoxGeometry(trackX * 2.1, groundOffset * 1.35, (loop.zFront - loop.zRear) * 1.15);
  const shadowCasterMat = new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const shadowCaster = new T.Mesh(shadowCasterGeo, shadowCasterMat);
  shadowCaster.position.set(0, groundOffset * 0.72, (loop.zFront + loop.zRear) * 0.5);
  shadowCaster.castShadow = true;
  pitchFrame.add(shadowCaster);

  // Dedicated ground-hugging contact ambient occlusion shadows
  if (typeof document !== 'undefined') {
    const shadowTex = getContactShadowTexture();
    const shadowMat = new T.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    });
    const runnerLen = (loop.zFront - loop.zRear) + loop.rTrack * 2.5;
    const runnerGeo = new T.PlaneGeometry(shoeWidth * 1.55, runnerLen);
    runnerGeo.rotateX(-Math.PI / 2);

    const zMid = (loop.zFront + loop.zRear) * 0.5;
    const leftShadow = new T.Mesh(runnerGeo, shadowMat);
    leftShadow.position.set(trackX, 0.003, zMid);

    const rightShadow = new T.Mesh(runnerGeo, shadowMat);
    rightShadow.position.set(-trackX, 0.003, zMid);

    const bellyGeo = new T.PlaneGeometry(trackX * 1.4, runnerLen * 0.92);
    bellyGeo.rotateX(-Math.PI / 2);
    const bellyMat = new T.MeshBasicMaterial({
      color: '#070a08',
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const bellyShadow = new T.Mesh(bellyGeo, bellyMat);
    bellyShadow.position.set(0, 0.002, zMid);

    const contactShadows = new T.Group();
    contactShadows.add(leftShadow, rightShadow, bellyShadow);
    root.add(contactShadows);
  }

  // Crawler track shoe plates (44 shoes per track, ultra low-profile)
  const SHOE_COUNT = 44;
  const treadMaterial = new T.MeshStandardMaterial({
    color: '#222521',
    roughness: 0.86,
    metalness: 0.42,
  });
  const treadGeo = new T.BoxGeometry(shoeWidth, 0.006, 0.040);
  const dummy = new T.Object3D();
  const treadMeshes = [];

  for (const side of [1, -1]) {
    const inst = new T.InstancedMesh(treadGeo, treadMaterial, SHOE_COUNT);
    inst.instanceMatrix.setUsage(T.DynamicDrawUsage);
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.frustumCulled = false;
    const parent = side > 0 ? trackLeft : trackRight;
    parent.add(inst);
    treadMeshes.push({ inst, side });
  }

  // Internal rotating wheels: Front idler, rear drive sprocket, 4 lower rollers, 1 top roller
  const wheelMetalMat = new T.MeshStandardMaterial({
    color: '#343834',
    metalness: 0.72,
    roughness: 0.42,
  });
  const boltMat = new T.MeshStandardMaterial({
    color: '#7a8278',
    metalness: 0.85,
    roughness: 0.28,
  });

  const wheels = [];
  const rollerSpan = loop.zFront - loop.zRear;
  const rollerZs = [
    loop.zRear + rollerSpan * 0.18,
    loop.zRear + rollerSpan * 0.39,
    loop.zRear + rollerSpan * 0.61,
    loop.zRear + rollerSpan * 0.82,
  ];

  for (const side of [1, -1]) {
    const sIdx = side > 0 ? 0 : 1; // 0: Left, 1: Right
    const parent = side > 0 ? trackLeft : trackRight;
    const xPos = side * trackX;

    // 1. Front Idler Wheel
    {
      const group = new T.Group();
      group.position.set(xPos, loop.yMid, loop.zFront);
      const rim = new T.Mesh(new T.CylinderGeometry(loop.rTrack * 0.90, loop.rTrack * 0.90, 0.040, 18), wheelMetalMat);
      rim.rotation.z = Math.PI / 2;
      group.add(rim);
      const hub = new T.Mesh(new T.CylinderGeometry(0.042, 0.042, 0.048, 12), boltMat);
      hub.rotation.z = Math.PI / 2;
      group.add(hub);
      for (let k = 0; k < 4; k++) {
        const spoke = new T.Mesh(new T.BoxGeometry(0.014, loop.rTrack * 1.55, 0.016), boltMat);
        spoke.rotation.x = (k * Math.PI) / 4;
        group.add(spoke);
      }
      parent.add(group);
      wheels.push({ group, side: sIdx, radius: loop.rTrack * 0.90 });
    }

    // 2. Rear Drive Sprocket (with 12 drive teeth)
    {
      const group = new T.Group();
      group.position.set(xPos, loop.yMid, loop.zRear);
      const rim = new T.Mesh(new T.CylinderGeometry(loop.rTrack * 0.88, loop.rTrack * 0.88, 0.040, 18), wheelMetalMat);
      rim.rotation.z = Math.PI / 2;
      group.add(rim);
      const hub = new T.Mesh(new T.CylinderGeometry(0.048, 0.048, 0.048, 12), boltMat);
      hub.rotation.z = Math.PI / 2;
      group.add(hub);
      for (let k = 0; k < 12; k++) {
        const tooth = new T.Mesh(new T.BoxGeometry(0.016, 0.022, 0.034), wheelMetalMat);
        const ang = (k * Math.PI * 2) / 12;
        tooth.position.set(0, Math.sin(ang) * loop.rTrack * 0.90, Math.cos(ang) * loop.rTrack * 0.90);
        tooth.rotation.x = -ang;
        group.add(tooth);
      }
      parent.add(group);
      wheels.push({ group, side: sIdx, radius: loop.rTrack * 0.88 });
    }

    // 3. Lower Track Rollers (4 per side)
    for (const z of rollerZs) {
      const group = new T.Group();
      group.position.set(xPos, loop.yBot + 0.052, z);
      const roller = new T.Mesh(new T.CylinderGeometry(0.048, 0.048, 0.050, 14), wheelMetalMat);
      roller.rotation.z = Math.PI / 2;
      group.add(roller);
      const cap = new T.Mesh(new T.CylinderGeometry(0.020, 0.020, 0.056, 10), boltMat);
      cap.rotation.z = Math.PI / 2;
      group.add(cap);
      parent.add(group);
      wheels.push({ group, side: sIdx, radius: 0.048 });
    }

    // 4. Upper Carrier Roller (1 per side)
    {
      const group = new T.Group();
      group.position.set(xPos, loop.yTop - 0.048, (loop.zFront + loop.zRear) * 0.5);
      const roller = new T.Mesh(new T.CylinderGeometry(0.042, 0.042, 0.050, 14), wheelMetalMat);
      roller.rotation.z = Math.PI / 2;
      group.add(roller);
      parent.add(group);
      wheels.push({ group, side: sIdx, radius: -0.042 });
    }
  }

  // Category-specific Night Illumination:
  // - CTL: Dual front cab lamps + glowing lens flare corona sprites + amber roof beacon + wide bucket beam pool
  // - MHE: Compact soft forward oval ground pool + subtle SpotLight (DX-55 style)
  let spotLight = null;
  let poolMat = null;
  let groundPool = null;
  let lampMaterial = null;
  let beacon = null;
  const flares = [];

  if (isCTL) {
    const cabLamp = config.cabLamp || { x: 0.22, y: 0.96, z: 0.31 };
    const beaconPos = config.beacon || { x: 0.22, y: 1.07, z: -0.18 };

    lampMaterial = new T.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#fff6dd',
      emissiveIntensity: 0.8,
      roughness: 0.15,
    });
    for (const x of [-cabLamp.x, cabLamp.x]) {
      const lamp = new T.Mesh(new T.BoxGeometry(0.08, 0.04, 0.02), lampMaterial);
      lamp.position.set(x, cabLamp.y, cabLamp.z);
      pitchFrame.add(lamp);
    }

    beacon = new T.Mesh(
      new T.CylinderGeometry(0.026, 0.036, 0.05, 12),
      new T.MeshStandardMaterial({
        color: '#dba154',
        emissive: '#bd6b1f',
        emissiveIntensity: 0.7,
        roughness: 0.3,
      })
    );
    beacon.position.set(beaconPos.x, beaconPos.y, beaconPos.z);
    pitchFrame.add(beacon);

    if (typeof document !== 'undefined') {
      const flareTex = getCTLHeadlightFlareTexture();
      const flareMat = new T.SpriteMaterial({
        map: flareTex,
        color: '#ffffff',
        transparent: true,
        opacity: 0,
        blending: T.AdditiveBlending,
        depthWrite: false,
      });
      for (const x of [-cabLamp.x, cabLamp.x]) {
        const sp = new T.Sprite(flareMat);
        sp.position.set(x, cabLamp.y, cabLamp.z + 0.02);
        sp.scale.set(0.28, 0.28, 1);
        pitchFrame.add(sp);
        flares.push(sp);
      }
    }

    spotLight = new T.SpotLight('#fff4d6', 0, 11, Math.PI / 3.3, 0.85, 1.7);
    spotLight.position.set(0, cabLamp.y, cabLamp.z);
    const spotTarget = new T.Object3D();
    spotTarget.position.set(0, 0, 3.0);
    pitchFrame.add(spotLight, spotTarget);
    spotLight.target = spotTarget;

    if (typeof document !== 'undefined') {
      const poolTex = getCTLHeadlightPoolTexture();
      const poolGeo = new T.PlaneGeometry(3.6 / scale, 2.9 / scale);
      poolGeo.rotateX(-Math.PI / 2);
      poolMat = new T.MeshBasicMaterial({
        map: poolTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: T.NormalBlending,
      });
      groundPool = new T.Mesh(poolGeo, poolMat);
      groundPool.position.set(0, 0.005, 1.95 / scale);
      root.add(groundPool);
    }
  } else {
    // MHE (DX-55, Yanmar ViO20, Yanmar ViO30) night lighting
    spotLight = new T.SpotLight('#fff4d6', 0, 11, Math.PI / 4.0, 0.85, 1.8);
    spotLight.position.set(0, 1.1, 0.3);
    const spotTarget = new T.Object3D();
    spotTarget.position.set(0, 0, 3.2);
    pitchFrame.add(spotLight, spotTarget);
    spotLight.target = spotTarget;

    if (typeof document !== 'undefined') {
      const poolTex = getMHEHeadlightPoolTexture();
      const poolGeo = new T.PlaneGeometry(2.6 / scale, 3.0 / scale);
      poolGeo.rotateX(-Math.PI / 2);
      poolMat = new T.MeshBasicMaterial({
        map: poolTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: T.NormalBlending,
      });
      groundPool = new T.Mesh(poolGeo, poolMat);
      groundPool.position.set(0, 0.005, 1.95 / scale);
      root.add(groundPool);
    }
  }

  const encodedFile = encodeURIComponent(glbFile).replace(/%20/g, '%20');
  const candidateUrls = [
    glbUrl,
    new URL(`./assets/${encodedFile}`, import.meta.url).href,
    `/field-simulation/assets/${encodedFile}`,
    `assets/${encodedFile}`,
  ].filter(Boolean);

  let loadedMesh = null;
  const loader = new GLTFLoader();

  async function loadModel() {
    if (typeof window === 'undefined' && typeof fetch === 'undefined') return null;
    for (const url of candidateUrls) {
      try {
        const gltf = await new Promise((resolve, reject) => {
          loader.load(url, resolve, undefined, reject);
        });

        loadedMesh = gltf.scene;
        loadedMesh.name = `${config.id}-Body`;

        loadedMesh.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = false;
            child.receiveShadow = false;
            if (child.material) {
              // Disable mipmap downsampling on fragmented UV atlases so adjacent
              // orange/yellow/white body islands never bleed into black cab/track/bucket UVs
              if (child.material.map) {
                child.material.map.colorSpace = T.SRGBColorSpace;
                child.material.map.generateMipmaps = false;
                child.material.map.minFilter = T.LinearFilter;
                child.material.map.magFilter = T.LinearFilter;
                child.material.map.needsUpdate = true;
              }
              // Remove fragmented atlas normal/metallicRoughness maps that cause
              // seam speckles at overview distance, and apply clean uniform PBR values
              child.material.normalMap = null;
              child.material.metalnessMap = null;
              child.material.roughnessMap = null;
              child.material.roughness = 0.52;
              child.material.metalness = 0.15;
              child.material.needsUpdate = true;
            }
          }
        });

        meshHolder.add(loadedMesh);
        console.log(`[${config.name}] Successfully loaded 3D GLB model from: ${url}`);
        return loadedMesh;
      } catch (err) {
        console.warn(`[${config.name}] Failed to load from ${url}:`, err?.message || err);
      }
    }
    console.error(`[${config.name}] Could not load GLB model from candidate URLs.`);
    return null;
  }

  const loadPromise = typeof window !== 'undefined' ? enqueueLoad(loadModel) : Promise.resolve(null);

  let prevSpeed = 0;
  let prevYaw = 0;
  let prevTime = 0;
  let currentSquat = 0;
  let currentRoll = 0;

  function update(motion, night = 0) {
    const n = typeof night === 'number' ? night : 0;
    // 1. Position & Yaw (firm ground contact)
    root.position.set(motion.x, motion.y + 0.012, motion.z);
    root.rotation.y = motion.yaw;
    root.rotation.x = 0;
    root.rotation.z = 0;

    // 2. Heavy machinery suspension inertia
    const dt = Math.max(0.001, Math.min(0.1, (motion.time || 0) - prevTime));
    const accel = ((motion.speed || 0) - prevSpeed) / dt;
    const yawRate = ((motion.yaw || 0) - prevYaw) / dt;
    prevSpeed = motion.speed || 0;
    prevYaw = motion.yaw || 0;
    prevTime = motion.time || 0;

    // Acceleration squat (rear dips) & braking dive (front dips)
    const targetSquat = T.MathUtils.clamp(-accel * 0.008, -0.025, 0.025);
    currentSquat = T.MathUtils.lerp(currentSquat, targetSquat, 1 - Math.exp(-dt * 6));

    // Centrifugal roll during steering
    const targetRoll = T.MathUtils.clamp(-yawRate * (motion.speed || 0) * 0.04, -0.035, 0.035);
    currentRoll = T.MathUtils.lerp(currentRoll, targetRoll, 1 - Math.exp(-dt * 8));

    const pose = motion.pose || {};
    pitchFrame.rotation.x = (pose.pitch || 0) + currentSquat;
    pitchFrame.rotation.z = (pose.roll || 0) + currentRoll;
    pitchFrame.position.y = (pose.heave || 0) / scale;

    // 3. Crawler track shoe belt continuous circulation
    for (let s = 0; s < treadMeshes.length; s++) {
      const { inst, side } = treadMeshes[s];
      const dist = (side > 0 ? motion.leftDistance : motion.rightDistance) / scale;
      for (let i = 0; i < SHOE_COUNT; i++) {
        const p = loop.pointAt((i / SHOE_COUNT) * loop.trackLength - dist);
        dummy.position.set(
          side * trackX,
          p.y - 0.002 * Math.cos(p.angle),
          p.z - 0.002 * Math.sin(p.angle)
        );
        dummy.rotation.set(p.angle, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
    }

    // 4. Mechanical sprockets, idlers, and roller rotation
    for (const w of wheels) {
      const dist = (w.side === 0 ? motion.leftDistance : motion.rightDistance) / scale;
      w.group.rotation.x = dist / w.radius;
    }

    // 5. Heavy diesel engine vibration
    if (motion.speed > 0.05) {
      const vib = Math.sin((motion.time || 0) * 32) * 0.0018 * Math.min(motion.speed, 1.8);
      meshHolder.position.y = groundOffset + vib;
    } else {
      const idle = Math.sin((motion.time || 0) * 22) * 0.0010;
      meshHolder.position.y = groundOffset + idle;
    }

    // 6. Night forward illumination (CTL vs MHE)
    if (isCTL) {
      if (beacon) {
        beacon.material.emissiveIntensity = (0.55 + Math.max(0, Math.sin((motion.time || 0) * 5)) * 0.8) * (1 + n * 0.5);
      }
      spotLight.intensity = n * 2.6;
      spotLight.visible = n > 0.02;
      if (groundPool) {
        groundPool.visible = n > 0.02;
        if (poolMat) poolMat.opacity = n * 0.48;
      }
      if (lampMaterial) {
        lampMaterial.emissiveIntensity = 0.4 + n * 5.2;
        lampMaterial.emissive.set(n > 0.1 ? '#ffffff' : '#ffe5ab');
      }
      for (const f of flares) {
        f.visible = n > 0.02;
        f.material.opacity = n * 0.95;
        f.scale.setScalar(0.26 + n * 0.06 + Math.sin((motion.time || 0) * 16) * 0.008);
      }
    } else {
      spotLight.intensity = n * 2.8;
      spotLight.visible = n > 0.02;
      if (groundPool) {
        groundPool.visible = n > 0.02;
        if (poolMat) poolMat.opacity = n * 0.48;
      }
    }
  }

  //Initialize track shoe matrices at rest so bounding box is valid immediately
  update({ x: 0, y: 0, z: 0, yaw: 0, speed: 0, time: 0, leftDistance: 0, rightDistance: 0, pose: {} }, 0);

  return {
    root,
    update,
    pickBox,
    source: candidateUrls[0],
    ready: loadPromise,
    parts: { body: meshHolder, trackLeft, trackRight },
  };
}

export async function createDX55({ glbUrl } = {}) {
  return createGLBEquipment(EQUIPMENTS['dx-55'], { glbUrl });
}
