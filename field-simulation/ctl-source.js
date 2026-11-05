// Geometry adapted from ../preview_ctl_3d.html; original preserved.
function vec3(x,y,z){return {x,y,z};}
    function addBox(faces, x0, y0, z0, x1, y1, z1, colors, tag = '', isWhiteFrame = false) {
      const c = typeof colors === 'string'
        ? { top: colors, bottom: colors, front: colors, back: colors, left: colors, right: colors }
        : {
            top: colors.top || colors.base,
            bottom: colors.bottom || colors.base,
            front: colors.front || colors.base,
            back: colors.back || colors.base,
            left: colors.left || colors.base,
            right: colors.right || colors.base
          };

      const v = [
        vec3(x0, y0, z0), vec3(x1, y0, z0), vec3(x1, y1, z0), vec3(x0, y1, z0),
        vec3(x0, y0, z1), vec3(x1, y0, z1), vec3(x1, y1, z1), vec3(x0, y1, z1)
      ];

      faces.push({ verts: [v[3], v[2], v[6], v[7]], color: c.top, tag, isWhiteFrame });
      faces.push({ verts: [v[0], v[4], v[5], v[1]], color: c.bottom, tag, isWhiteFrame });
      faces.push({ verts: [v[4], v[7], v[6], v[5]], color: c.front, tag, isWhiteFrame });
      faces.push({ verts: [v[1], v[2], v[3], v[0]], color: c.back, tag: tag === 'tailgate' ? 'tailgate_back' : tag, isWhiteFrame });
      faces.push({ verts: [v[0], v[3], v[7], v[4]], color: c.left, tag: tag === 'cab' ? 'cab_side' : tag, isWhiteFrame });
      faces.push({ verts: [v[5], v[6], v[2], v[1]], color: c.right, tag: tag === 'cab' ? 'cab_side' : tag, isWhiteFrame });
    }

    function addHexahedron(faces, pts, color, tag = '', isWhiteFrame = false) {
      faces.push({ verts: [pts[4], pts[5], pts[6], pts[7]], color, tag: tag ? tag + '_top' : '', isWhiteFrame });
      faces.push({ verts: [pts[0], pts[3], pts[2], pts[1]], color, tag, isWhiteFrame });
      faces.push({ verts: [pts[3], pts[7], pts[6], pts[2]], color, tag: tag ? tag + '_front' : '', isWhiteFrame });
      faces.push({ verts: [pts[1], pts[5], pts[4], pts[0]], color, tag: tag ? tag + '_back' : '', isWhiteFrame });
      faces.push({ verts: [pts[0], pts[4], pts[7], pts[3]], color, tag: tag ? tag + '_outer' : '', isWhiteFrame });
      faces.push({ verts: [pts[2], pts[6], pts[5], pts[1]], color, tag: tag ? tag + '_inner' : '', isWhiteFrame });
    }

    function addCylinderX(faces, x0, x1, cy, cz, r, segments, sideColor, capColor) {
      const capLeft = [];
      const capRight = [];
      for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * Math.PI * 2;
        const a1 = ((i + 1) / segments) * Math.PI * 2;
        const y0 = cy + Math.sin(a0) * r;
        const z0 = cz + Math.cos(a0) * r;
        const y1 = cy + Math.sin(a1) * r;
        const z1 = cz + Math.cos(a1) * r;

        faces.push({
          verts: [vec3(x0, y0, z0), vec3(x0, y1, z1), vec3(x1, y1, z1), vec3(x1, y0, z0)],
          color: sideColor
        });
        capLeft.push(vec3(x0, y0, z0));
        capRight.unshift(vec3(x1, y0, z0));
      }
      faces.push({ verts: capLeft, color: capColor });
      faces.push({ verts: capRight, color: capColor });
    }

    // =========================================================================
    // Bobcat CTL 3D 메쉬 조립 (화이트 프레임 볼륨 대폭 강화)
    // =========================================================================
    export function buildBobcatCTLMesh(armLift = 0.08, trackPhase = 0) {
      const faces = [];

      // 순백색(Pure Bright White)으로 그림자에서도 선명한 흰색 유지
      const C_WHITE = '#ffffff';
      const C_ORANGE = '#ea580c';
      const C_CAB = '#272b33';
      const C_CAB_ROOF = '#323842';
      const C_TRACK = '#1c1f24';
      const C_TRACK_LUG = '#282d35';
      const C_STEEL = '#20242a';
      const C_BUCKET = '#252930';
      const C_CHROME = '#e2e8f0';

      // 1. 좌/우 삼각 고무트랙(Rubber Track) 및 롤러
      [-1, 1].forEach((side) => {
        const trackStart = faces.length;
        const xIn = side * 0.58;
        const xOut = side * 0.95;
        const xL = Math.min(xIn, xOut);
        const xR = Math.max(xIn, xOut);

        const loop = [
          { y: 0.04, z: -0.92 },
          { y: 0.04, z:  0.95 },
          { y: 0.24, z:  1.15 },
          { y: 0.44, z:  1.02 },
          { y: 0.72, z:  0.04 },
          { y: 0.72, z: -0.18 },
          { y: 0.44, z: -1.04 },
          { y: 0.22, z: -1.13 }
        ];

        const innerLoop = loop.map((p) => ({
          y: p.y + (0.35 - p.y) * 0.26,
          z: p.z * 0.86
        }));

        for (let i = 0; i < loop.length; i++) {
          const ni = (i + 1) % loop.length;
          const p0 = loop[i], p1 = loop[ni];
          const q0 = innerLoop[i], q1 = innerLoop[ni];

          faces.push({
            verts: [vec3(xL, p0.y, p0.z), vec3(xL, p1.y, p1.z), vec3(xR, p1.y, p1.z), vec3(xR, p0.y, p0.z)],
            color: C_TRACK
          });
          const sx = side < 0 ? xL : xR;
          const vA = vec3(sx, p0.y, p0.z);
          const vB = vec3(sx, p1.y, p1.z);
          const vC = vec3(sx, q1.y, q1.z);
          const vD = vec3(sx, q0.y, q0.z);
          faces.push({
            verts: side < 0 ? [vA, vD, vC, vB] : [vA, vB, vC, vD],
            color: '#15171b'
          });
        }

        addBox(faces, xL + 0.04, 0.14, -0.94, xR - 0.04, 0.36, 0.96, '#141619');

        const wheelX0 = side < 0 ? xL - 0.01 : xL + 0.04;
        const wheelX1 = side < 0 ? xR - 0.04 : xR + 0.01;
        addCylinderX(faces, wheelX0, wheelX1, 0.56, -0.07, 0.15, 10, '#2a2e35', '#3f4652');
        addCylinderX(faces, wheelX0, wheelX1, 0.27,  0.92, 0.16, 10, '#252930', '#383e48');
        addCylinderX(faces, wheelX0, wheelX1, 0.27, -0.88, 0.16, 10, '#252930', '#383e48');
        [-0.52, -0.18, 0.16, 0.50].forEach((rz) => {
          addCylinderX(faces, wheelX0, wheelX1, 0.14, rz, 0.085, 8, '#1f2329', '#323842');
        });

        faces.slice(trackStart).forEach(f => f.part = side < 0 ? 'trackLeft' : 'trackRight');
        const lugCount = 0;
        for (let k = 0; k < lugCount; k++) {
          const t = ((k / lugCount) + trackPhase) % 1;
          const segFloat = t * loop.length;
          const idx = Math.floor(segFloat);
          const frac = segFloat - idx;
          const a = loop[idx];
          const b = loop[(idx + 1) % loop.length];
          const ly = a.y + (b.y - a.y) * frac;
          const lz = a.z + (b.z - a.z) * frac;
          const dy = b.y - a.y;
          const dz = b.z - a.z;
          const len = Math.hypot(dy, dz) || 1;
          const ny = dz / len * 0.03;
          const nz = -dy / len * 0.03;
          faces.push({
            verts: [
              vec3(xL + 0.01, ly, lz),
              vec3(xL + 0.01, ly + ny, lz + nz),
              vec3(xR - 0.01, ly + ny, lz + nz),
              vec3(xR - 0.01, ly, lz)
            ],
            color: C_TRACK_LUG
          });
        }
      });

      faces.forEach(f => { if (!f.part) f.part = 'body'; });
      // 2. 하부 메인 차체 및 화이트 사이드 바디 스커트 (트랙 위쪽 흰색 차체 라인)
      addBox(faces, -0.57, 0.18, -1.05, 0.57, 0.52, 0.88, C_STEEL);
      addBox(faces, -0.46, 0.22, 0.88, 0.46, 0.42, 1.05, '#1b1e23');

      // 3. 후면 오렌지 테일게이트 & 상단 블랙 라디에이터 그릴
      addBox(faces, -0.58, 0.20, -1.25, 0.58, 0.35, -1.02, '#181b20');
      addBox(faces, -0.53, 0.35, -1.24, 0.53, 1.00, -0.95, {
        base: C_ORANGE,
        top: '#f97316',
        back: C_ORANGE,
        left: '#d9480f',
        right: '#d9480f'
      }, 'tailgate');

      // 후면 상단 블랙 엔진 방열 그릴 (화이트 프레임 사이에 선명하게 안착)
      const grillePts = [
        vec3(-0.52, 1.00, -1.20), vec3(0.52, 1.00, -1.20), vec3(0.52, 1.00, -0.42), vec3(-0.52, 1.00, -0.42),
        vec3(-0.48, 1.12, -1.10), vec3(0.48, 1.12, -1.10), vec3(0.48, 1.18, -0.42), vec3(-0.48, 1.18, -0.42)
      ];
      addHexahedron(faces, grillePts, '#1e2228', 'grille');

      // 4. 차콜 블랙 ROPS 캐빈
      const cabPts = [
        vec3(-0.47, 0.54, -0.45), vec3(0.47, 0.54, -0.45), vec3(0.47, 0.54, 0.72), vec3(-0.47, 0.54, 0.72),
        vec3(-0.43, 1.63, -0.38), vec3(0.43, 1.63, -0.38), vec3(0.43, 1.56, 0.46), vec3(-0.43, 1.56, 0.46)
      ];
      addHexahedron(faces, cabPts, C_CAB, 'cab');

      addBox(faces, -0.41, 1.59, -0.34, 0.41, 1.67, 0.40, C_CAB_ROOF);
      addBox(faces, -0.25, 1.672, -0.10, 0.25, 1.68, 0.24, '#1e293b');
      addBox(faces, -0.39, 1.50, 0.45, -0.25, 1.57, 0.49, '#f8fafc');
      addBox(faces,  0.25, 1.50, 0.45,  0.39, 1.57, 0.49, '#f8fafc');

      // -----------------------------------------------------------------------
      // 5. ★ 퓨어 화이트 프레임 & 리프트 암 구조 (두께와 면적을 레퍼런스처럼 대폭 강조!)
      // -----------------------------------------------------------------------
      const liftAngle = armLift * 0.52;
      const cosA = Math.cos(liftAngle);
      const sinA = Math.sin(liftAngle);

      function pivotArm(y, z) {
        const dy = y - 1.28;
        const dz = z - (-0.90);
        return {
          y: 1.28 + dy * cosA + dz * sinA,
          z: -0.90 - dy * sinA + dz * cosA
        };
      }

      [-1, 1].forEach((side) => {
        const ax0 = side < 0 ? -0.74 : 0.49;
        const ax1 = side < 0 ? -0.49 : 0.74;

        // 5-0) 하단 화이트 사이드 바디 가드 (트랙 바로 위를 감싸는 흰색 차체 프레임)
        addBox(faces, ax0 + 0.02, 0.40, -1.18, ax1 - 0.02, 0.62, 0.55, C_WHITE, '', true);

        // 5-1) 후방 수직 화이트 타워 기둥 (리프트 암과 Z축이 겹치지 않도록 z: -1.22 ~ -0.68 구간에 정렬)
        const tx0 = side < 0 ? ax0 + 0.012 : ax0;
        const tx1 = side < 0 ? ax1 : ax1 - 0.012;
        const towerPts = [
          vec3(tx0, 0.42, -1.22), vec3(tx1, 0.42, -1.22), vec3(tx1, 0.42, -0.68), vec3(tx0, 0.42, -0.68),
          vec3(tx0, 1.44, -1.10), vec3(tx1, 1.44, -1.10), vec3(tx1, 1.38, -0.70), vec3(tx0, 1.38, -0.70)
        ];
        addHexahedron(faces, towerPts, C_WHITE, side < 0 ? 'tower_left' : 'tower_right', true);

        const movingArmStart=faces.length;
        // 5-2) 측면 메인 화이트 리프트 암 (타워 앞쪽 z: -0.68 ~ +0.30 구간으로 분리하여 360도 어느 각도에서도 가려짐 없음!)
        const pRearBot = pivotArm(0.92, -0.68);
        const pRearTop = pivotArm(1.36, -0.68);
        const pMidBot  = pivotArm(0.56,  0.28);
        const pMidTop  = pivotArm(0.94,  0.32);
        const pFrtBot  = pivotArm(0.18,  1.06);
        const pFrtTop  = pivotArm(0.46,  1.00);

        addHexahedron(faces, [
          vec3(ax0, pRearBot.y, pRearBot.z), vec3(ax1, pRearBot.y, pRearBot.z),
          vec3(ax1, pMidBot.y,  pMidBot.z),  vec3(ax0, pMidBot.y,  pMidBot.z),
          vec3(ax0, pRearTop.y, pRearTop.z), vec3(ax1, pRearTop.y, pRearTop.z),
          vec3(ax1, pMidTop.y,  pMidTop.z),  vec3(ax0, pMidTop.y,  pMidTop.z)
        ], C_WHITE, side < 0 ? 'arm_left' : 'arm_right', true);

        // 전방 하향 화이트 암 구간 (중간 꺾임부 -> 버킷 피벗)
        addHexahedron(faces, [
          vec3(ax0, pMidBot.y, pMidBot.z), vec3(ax1, pMidBot.y, pMidBot.z),
          vec3(ax1, pFrtBot.y, pFrtBot.z), vec3(ax0, pFrtBot.y, pFrtBot.z),
          vec3(ax0, pMidTop.y, pMidTop.z), vec3(ax1, pMidTop.y, pMidTop.z),
          vec3(ax1, pFrtTop.y, pFrtTop.z), vec3(ax0, pFrtTop.y, pFrtTop.z)
        ], C_WHITE, '', true);

        faces.slice(movingArmStart).forEach(f=>f.part='arm');
        // 5-3) 측면 유압 실린더 (블랙 배럴 + 크롬 로드)
        const cylX0 = side < 0 ? -0.71 : 0.53;
        const cylX1 = side < 0 ? -0.53 : 0.71;
        const cMount = pivotArm(0.76, 0.08);
        addHexahedron(faces, [
          vec3(cylX0, 0.54, -0.78), vec3(cylX1, 0.54, -0.78),
          vec3(cylX1, 0.66, -0.22), vec3(cylX0, 0.66, -0.22),
          vec3(cylX0, 0.63, -0.78), vec3(cylX1, 0.63, -0.78),
          vec3(cylX1, 0.75, -0.22), vec3(cylX0, 0.75, -0.22)
        ], '#181b20');
        addHexahedron(faces, [
          vec3(cylX0 + 0.03, 0.67, -0.24), vec3(cylX1 - 0.03, 0.67, -0.24),
          vec3(cylX1 - 0.03, cMount.y - 0.03, cMount.z), vec3(cylX0 + 0.03, cMount.y - 0.03, cMount.z),
          vec3(cylX0 + 0.03, 0.73, -0.24), vec3(cylX1 - 0.03, 0.73, -0.24),
          vec3(cylX1 - 0.03, cMount.y + 0.02, cMount.z), vec3(cylX0 + 0.03, cMount.y + 0.02, cMount.z)
        ], C_CHROME);
      });

      // 5-4) 후방 상단 화이트 아치형 크로스바 핸들 (레퍼런스 사진 후면 상단의 선명한 흰색 가로바!)
      const tieStart=faces.length;
      const tieBot = pivotArm(1.34, -1.04);
      const tieTop = pivotArm(1.45, -1.02);
      addBox(faces, -0.73, tieBot.y, tieBot.z - 0.06, 0.73, tieTop.y, tieTop.z + 0.06, C_WHITE, '', true);

      // 전방 화이트 암 연결 브릿지
      const frtCross = pivotArm(0.34, 0.96);
      addBox(faces, -0.62, frtCross.y - 0.07, frtCross.z - 0.07, 0.62, frtCross.y + 0.07, frtCross.z + 0.07, C_WHITE, '', true);
      addBox(faces, -0.10, frtCross.y - 0.02, frtCross.z, 0.10, frtCross.y + 0.16, frtCross.z + 0.22, '#1e2229');

      faces.slice(tieStart).forEach(f=>f.part='arm');
      const bucketStart=faces.length;
      // 6. 전면 로더 버킷
      const bPivot = pivotArm(0.22, 1.06);
      const by = bPivot.y - 0.16;
      const bz = bPivot.z;

      addHexahedron(faces, [
        vec3(-0.98, by,        bz),        vec3(0.98, by,        bz),
        vec3(0.98,  by,        bz + 0.10), vec3(-0.98, by,        bz + 0.10),
        vec3(-0.98, by + 0.52, bz - 0.06), vec3(0.98, by + 0.52, bz - 0.06),
        vec3(0.98,  by + 0.52, bz + 0.04), vec3(-0.98, by + 0.52, bz + 0.04)
      ], C_BUCKET);

      addHexahedron(faces, [
        vec3(-0.98, by + 0.50, bz - 0.06), vec3(0.98, by + 0.50, bz - 0.06),
        vec3(0.98,  by + 0.56, bz + 0.16), vec3(-0.98, by + 0.56, bz + 0.16),
        vec3(-0.98, by + 0.55, bz - 0.04), vec3(0.98, by + 0.55, bz - 0.04),
        vec3(0.98,  by + 0.60, bz + 0.16), vec3(-0.98, by + 0.60, bz + 0.16)
      ], '#30353e');

      addHexahedron(faces, [
        vec3(-0.98, by - 0.02, bz),        vec3(0.98, by - 0.02, bz),
        vec3(0.98,  by - 0.03, bz + 0.68), vec3(-0.98, by - 0.03, bz + 0.68),
        vec3(-0.98, by + 0.05, bz),        vec3(0.98, by + 0.05, bz),
        vec3(0.98,  by + 0.02, bz + 0.68), vec3(-0.98, by + 0.02, bz + 0.68)
      ], '#1e2126');

      addBox(faces, -0.99, by - 0.03, bz + 0.66, 0.99, by + 0.025, bz + 0.75, '#64748b');

      [-1, 1].forEach((side) => {
        const sx0 = side < 0 ? -0.99 : 0.93;
        const sx1 = side < 0 ? -0.93 : 0.99;
        addHexahedron(faces, [
          vec3(sx0, by,        bz),        vec3(sx1, by,        bz),
          vec3(sx1, by,        bz + 0.70), vec3(sx0, by,        bz + 0.70),
          vec3(sx0, by + 0.54, bz - 0.04), vec3(sx1, by + 0.54, bz - 0.04),
          vec3(sx1, by + 0.12, bz + 0.56), vec3(sx0, by + 0.12, bz + 0.56)
        ], C_BUCKET);
      });

      faces.slice(bucketStart).forEach(f=>f.part='bucket');
      return faces;
    }

    // =========================================================================
    // 3D 쿼드 표면 위에 오프스크린 텍스처(Bobcat 로고/레터링)를 투영 매핑하는 함수
    // =========================================================================
