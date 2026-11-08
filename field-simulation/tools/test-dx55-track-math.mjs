import * as THREE from '../vendor/three.module.js';

// Test track loop math for DX-55
const TRACK_LOOP = [
  [.04, .55], [.04, -.50],
  [.12, -.58], [.26, -.60], [.38, -.55],
  [.44, -.45], [.44, .45],
  [.38, .55], [.26, .60], [.12, .58]
];

const segments = TRACK_LOOP.map((a, i) => {
  const b = TRACK_LOOP[(i + 1) % TRACK_LOOP.length];
  return { a, b, length: Math.hypot(b[0] - a[0], b[1] - a[1]) };
});

const TRACK_LENGTH = segments.reduce((s, p) => s + p.length, 0);
console.log('DX-55 Track Length:', TRACK_LENGTH.toFixed(3));

function trackPoint(distance) {
  let d = ((distance % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH;
  for (const s of segments) {
    if (d <= s.length) {
      const t = d / s.length;
      return {
        y: THREE.MathUtils.lerp(s.a[0], s.b[0], t),
        x: THREE.MathUtils.lerp(s.a[1], s.b[1], t),
        angle: Math.atan2(s.b[0] - s.a[0], s.b[1] - s.a[1])
      };
    }
    d -= s.length;
  }
  return { y: .04, x: .55, angle: 0 };
}

for (let i = 0; i < 5; i++) {
  console.log(`Point ${i}:`, trackPoint(i * 0.5));
}
