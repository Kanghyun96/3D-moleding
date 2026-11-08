import * as T from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';

export const DX55_SCALE = 1.95;
export const DX55_BASE_YAW = Math.PI / 2; // +X in raw mesh aligns to +Z forward
export const DX55_GROUND_OFFSET = 0.738; // Grounded flush with terrain to eliminate hovering

// Track loop geometry (local units; scale 1.95 applies to root)
const R_TRACK = 0.130;
const Z_FRONT = 0.58;
const Z_REAR = -0.54;
const Y_BOT = 0.010;
const Y_MID = Y_BOT + R_TRACK; // 0.140
const Y_TOP = Y_BOT + 2 * R_TRACK; // 0.270
const LEN_STRAIGHT = Z_FRONT - Z_REAR; // 1.12
const LEN_ARC = Math.PI * R_TRACK; // ~0.4084
export const DX55_TRACK_LENGTH = 2 * LEN_STRAIGHT + 2 * LEN_ARC; // ~3.0568

function trackPoint(distance) {
  let d = ((distance % DX55_TRACK_LENGTH) + DX55_TRACK_LENGTH) % DX55_TRACK_LENGTH;
  // 1. Bottom straight: rear to front (Z goes from -0.54 to +0.58)
  if (d <= LEN_STRAIGHT) {
    const t = d / LEN_STRAIGHT;
    return { y: Y_BOT, z: Z_REAR + t * LEN_STRAIGHT, angle: 0 };
  }
  d -= LEN_STRAIGHT;
  // 2. Front idler curve: bottom to top
  if (d <= LEN_ARC) {
    const t = d / LEN_ARC;
    const phi = -Math.PI / 2 + t * Math.PI;
    return {
      y: Y_MID + R_TRACK * Math.sin(phi),
      z: Z_FRONT + R_TRACK * Math.cos(phi),
      angle: -t * Math.PI,
    };
  }
  d -= LEN_ARC;
  // 3. Top straight: front to rear (Z goes from +0.58 to -0.54)
  if (d <= LEN_STRAIGHT) {
    const t = d / LEN_STRAIGHT;
    return { y: Y_TOP, z: Z_FRONT - t * LEN_STRAIGHT, angle: -Math.PI };
  }
  d -= LEN_STRAIGHT;
  // 4. Rear drive sprocket curve: top to bottom
  const t = d / LEN_ARC;
  const phi = Math.PI / 2 + t * Math.PI;
  return {
    y: Y_MID + R_TRACK * Math.sin(phi),
    z: Z_REAR + R_TRACK * Math.cos(phi),
    angle: -Math.PI - t * Math.PI,
  };
}

function createContactShadowTexture() {
  if (typeof document === 'undefined') return null;
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

  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

function createHeadlightPoolTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);

  // Compact, soft forward oval (short reach, natural falloff)
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

  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

/**
 * Creates the 3D model instance and dynamic animation controller for Doosan DX-55 Excavator.
 * Features:
 * - Real-time continuous crawler track shoe belt circulation
 * - Rotating internal sprockets, idlers, and lower/upper track rollers
 * - Dedicated ground contact ambient shadow to eliminate hovering/floating
 * - Heavy machinery suspension physics (acceleration squat, braking dive, turn roll, diesel vibration)
 */
export async function createDX55({ glbUrl } = {}) {
  const root = new T.Group();
  root.name = 'Doosan DX-55';
  root.scale.setScalar(DX55_SCALE);

  const pitchFrame = new T.Group();
  root.add(pitchFrame);

  const trackLeft = new T.Group();
  trackLeft.name = 'DX55-Track-Left';
  const trackRight = new T.Group();
  trackRight.name = 'DX55-Track-Right';
  pitchFrame.add(trackLeft, trackRight);

  const meshHolder = new T.Group();
  meshHolder.rotation.y = DX55_BASE_YAW;
  meshHolder.position.y = DX55_GROUND_OFFSET;
  pitchFrame.add(meshHolder);

  // Dedicated ground-hugging contact ambient occlusion shadows
  if (typeof document !== 'undefined') {
    const shadowTex = createContactShadowTexture();
    const shadowMat = new T.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    });
    const runnerGeo = new T.PlaneGeometry(0.18, 1.45);
    runnerGeo.rotateX(-Math.PI / 2);

    const leftShadow = new T.Mesh(runnerGeo, shadowMat);
    leftShadow.position.set(0.366, 0.003, 0.02);

    const rightShadow = new T.Mesh(runnerGeo, shadowMat);
    rightShadow.position.set(-0.366, 0.003, 0.02);

    const bellyGeo = new T.PlaneGeometry(0.50, 1.35);
    bellyGeo.rotateX(-Math.PI / 2);
    const bellyMat = new T.MeshBasicMaterial({
      color: '#070a08',
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const bellyShadow = new T.Mesh(bellyGeo, bellyMat);
    bellyShadow.position.set(0, 0.002, 0.0);

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
  const treadGeo = new T.BoxGeometry(0.118, 0.006, 0.040);
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

  const dxWheels = [];
  for (const side of [1, -1]) {
    const sIdx = side > 0 ? 0 : 1; // 0: Left, 1: Right
    const parent = side > 0 ? trackLeft : trackRight;
    const xPos = side * 0.366;

    // 1. Front Idler Wheel (large smooth guide wheel)
    {
      const group = new T.Group();
      group.position.set(xPos, Y_MID, Z_FRONT);
      const rim = new T.Mesh(new T.CylinderGeometry(R_TRACK * 0.90, R_TRACK * 0.90, 0.040, 18), wheelMetalMat);
      rim.rotation.z = Math.PI / 2;
      group.add(rim);
      const hub = new T.Mesh(new T.CylinderGeometry(0.042, 0.042, 0.048, 12), boltMat);
      hub.rotation.z = Math.PI / 2;
      group.add(hub);
      for (let k = 0; k < 4; k++) {
        const spoke = new T.Mesh(new T.BoxGeometry(0.014, R_TRACK * 1.55, 0.016), boltMat);
        spoke.rotation.x = (k * Math.PI) / 4;
        group.add(spoke);
      }
      parent.add(group);
      dxWheels.push({ group, side: sIdx, radius: R_TRACK * 0.90 });
    }

    // 2. Rear Drive Sprocket (with 12 drive teeth)
    {
      const group = new T.Group();
      group.position.set(xPos, Y_MID, Z_REAR);
      const rim = new T.Mesh(new T.CylinderGeometry(R_TRACK * 0.88, R_TRACK * 0.88, 0.040, 18), wheelMetalMat);
      rim.rotation.z = Math.PI / 2;
      group.add(rim);
      const hub = new T.Mesh(new T.CylinderGeometry(0.048, 0.048, 0.048, 12), boltMat);
      hub.rotation.z = Math.PI / 2;
      group.add(hub);
      for (let k = 0; k < 12; k++) {
        const tooth = new T.Mesh(new T.BoxGeometry(0.016, 0.022, 0.034), wheelMetalMat);
        const ang = (k * Math.PI * 2) / 12;
        tooth.position.set(0, Math.sin(ang) * R_TRACK * 0.90, Math.cos(ang) * R_TRACK * 0.90);
        tooth.rotation.x = -ang;
        group.add(tooth);
      }
      parent.add(group);
      dxWheels.push({ group, side: sIdx, radius: R_TRACK * 0.88 });
    }

    // 3. Lower Track Rollers (4 per side)
    for (const z of [-0.34, -0.11, 0.12, 0.35]) {
      const group = new T.Group();
      group.position.set(xPos, Y_BOT + 0.052, z);
      const roller = new T.Mesh(new T.CylinderGeometry(0.048, 0.048, 0.050, 14), wheelMetalMat);
      roller.rotation.z = Math.PI / 2;
      group.add(roller);
      const cap = new T.Mesh(new T.CylinderGeometry(0.020, 0.020, 0.056, 10), boltMat);
      cap.rotation.z = Math.PI / 2;
      group.add(cap);
      parent.add(group);
      dxWheels.push({ group, side: sIdx, radius: 0.048 });
    }

    // 4. Upper Carrier Roller (1 per side)
    {
      const group = new T.Group();
      group.position.set(xPos, Y_TOP - 0.048, 0.02);
      const roller = new T.Mesh(new T.CylinderGeometry(0.042, 0.042, 0.050, 14), wheelMetalMat);
      roller.rotation.z = Math.PI / 2;
      group.add(roller);
      parent.add(group);
      dxWheels.push({ group, side: sIdx, radius: -0.042 });
    }
  }

  // Night forward illumination: Soft compact ground pool + subtle SpotLight
  const dxSpot = new T.SpotLight('#fff4d6', 0, 11, Math.PI / 4.0, 0.85, 1.8);
  dxSpot.position.set(0, 1.1, 0.3);
  const dxTarget = new T.Object3D();
  dxTarget.position.set(0, 0, 3.2);
  pitchFrame.add(dxSpot, dxTarget);
  dxSpot.target = dxTarget;

  // Ground light pool (compact, tightly placed in front of tracks, firmly on ground)
  let dxPoolMat = null, dxGroundPool = null;
  if (typeof document !== 'undefined') {
    const poolTex = createHeadlightPoolTexture();
    const poolGeo = new T.PlaneGeometry(2.6 / DX55_SCALE, 3.0 / DX55_SCALE);
    poolGeo.rotateX(-Math.PI / 2);
    dxPoolMat = new T.MeshBasicMaterial({
      map: poolTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: T.NormalBlending,
    });
    dxGroundPool = new T.Mesh(poolGeo, dxPoolMat);
    dxGroundPool.position.set(0, 0.005, 1.95 / DX55_SCALE);
    root.add(dxGroundPool);
  }

  // Candidate URLs to guarantee reliable loading in any environment
  const candidateUrls = [
    glbUrl,
    new URL('./assets/DX-55.glb', import.meta.url).href,
    new URL('../picture/DX-55.glb', import.meta.url).href,
    '/field-simulation/assets/DX-55.glb',
    '/picture/DX-55.glb',
    'assets/DX-55.glb',
    'picture/DX-55.glb',
  ].filter(Boolean);

  let loadedMesh = null;
  const loader = new GLTFLoader();

  async function loadModel() {
    for (const url of candidateUrls) {
      try {
        const gltf = await new Promise((resolve, reject) => {
          loader.load(url, resolve, undefined, reject);
        });

        loadedMesh = gltf.scene;
        loadedMesh.name = 'DX-55-Body';

        loadedMesh.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material.roughness = Math.max(child.material.roughness ?? 0.5, 0.45);
              child.material.metalness = Math.min(child.material.metalness ?? 0.2, 0.65);
              if (child.material.map) child.material.map.colorSpace = T.SRGBColorSpace;
            }
          }
        });

        meshHolder.add(loadedMesh);
        console.log(`[DX-55] Successfully loaded clean 3D model from: ${url}`);
        return loadedMesh;
      } catch (err) {
        console.warn(`[DX-55] Failed to load from ${url}:`, err?.message || err);
      }
    }
    console.error('[DX-55] Could not load DX-55 model from candidate URLs.');
    return null;
  }

  const loadPromise = loadModel();
  await loadPromise;

  // Track dynamic state for inertia calculations
  let prevSpeed = 0;
  let prevYaw = 0;
  let prevTime = 0;
  let currentSquat = 0;
  let currentRoll = 0;

  // Motion update handler: Realistic heavy crawler dynamics & rolling wheel mechanics
  function update(motion, night = 0) {
    const n = typeof night === 'number' ? night : 0;
    // 1. Position & Yaw (ground contact)
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
    pitchFrame.position.y = (pose.heave || 0) / DX55_SCALE;

    // 3. Crawler track shoe belt continuous circulation
    for (let s = 0; s < treadMeshes.length; s++) {
      const { inst, side } = treadMeshes[s];
      const dist = (side > 0 ? motion.leftDistance : motion.rightDistance) / DX55_SCALE;
      for (let i = 0; i < SHOE_COUNT; i++) {
        // At the bottom, belt travels backwards relative to chassis (gripping the ground)
        const p = trackPoint((i / SHOE_COUNT) * DX55_TRACK_LENGTH - dist);
        dummy.position.set(
          side * 0.366,
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
    for (const w of dxWheels) {
      const dist = (w.side === 0 ? motion.leftDistance : motion.rightDistance) / DX55_SCALE;
      w.group.rotation.x = dist / w.radius;
    }

    // 5. Heavy diesel engine vibration
    if (motion.speed > 0.05) {
      const vib = Math.sin((motion.time || 0) * 32) * 0.0018 * Math.min(motion.speed, 1.8);
      meshHolder.position.y = DX55_GROUND_OFFSET + vib;
    } else {
      const idle = Math.sin((motion.time || 0) * 22) * 0.0010;
      meshHolder.position.y = DX55_GROUND_OFFSET + idle;
    }

    // 6. Night forward illumination (ground pool & subtle forward light)
    dxSpot.intensity = n * 2.8;
    dxSpot.visible = n > 0.02;
    if (dxGroundPool) {
      dxGroundPool.visible = n > 0.02;
      if (dxPoolMat) dxPoolMat.opacity = n * 0.48;
    }
  }

  return {
    root,
    update,
    source: candidateUrls[0],
    ready: loadPromise,
    parts: { body: meshHolder, trackLeft, trackRight },
  };
}
