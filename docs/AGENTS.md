# TrackVision 3D Equipment Addition Standard & Engineering Rules
(장비 추가 표준 규격 및 엔지니어링 규칙)

이 문서는 프로젝트에 새로운 건설/토목 장비(3D 모델)를 추가할 때 반드시 준수해야 하는 표준 구현 원칙과 파이프라인을 정의합니다. 앞으로 사용자가 장비 추가를 요청할 때, 매번 동일한 요구사항을 반복하지 않더라도 아래의 규칙과 물리 로직이 100% 자동 적용됩니다.

---

## 1. 주차 슬롯 배정 및 독립 라우팅 (Dedicated Slot & Independent Routing)
- **슬롯 배정**: 모든 신규 장비는 고유한 주차 슬롯(`P01`, `P02`, `P03`, `P04`, `P05`, `P06`, `P07`) 중 하나를 영구 할당받습니다.
  - 현재 할당: `bobcat-t870` -> `P03`, `dx-55` -> `P01`.
  - 다음 추가 장비 우선 슬롯: `P02` -> `P04` -> `P05` 순서.
- **슬롯 독립 경로 (`routes.js`)**:
  - 장비는 다른 장비의 자리에 겹쳐 생성되거나 순간이동(Teleport)하지 않고, 자신에게 배정된 슬롯(`home_P01`, `home_P02` 등)에서 출발하여 게이트를 거쳐 시험로로 진입합니다.
  - 복귀 시에도 자신의 주차 슬롯으로 정확히 정렬 복귀합니다.
- **등록 파일**: `parking-config.js`, `routes.js`, `equipment-schema.js`, `data/equipment.json`.

---

## 2. 3D 모델 로딩, 스케일링 및 접지 (Accurate Scaling & Ground Contact)
- **규격 및 스케일**: 실물 제원표(카탈로그)의 전폭/전장/전고에 맞추어 `SCALE`과 `BASE_YAW`를 정확히 설정합니다.
- **"둥둥 떠다니는 느낌(호버크래프트 현상)" 절대 방지**:
  1. **접지 높이 (`GROUND_OFFSET`)**: 트랙/바퀴 밑면이 지면 위로 뜨지 않고 지면(아스팔트/흙길)에 묵직하게 밀착되도록 조정합니다.
  2. **접촉 암부 그림자 (Contact Ambient Occlusion Shadow Plane)**:
     - Three.js 그림자 바이어스로 인한 빛샘(Peter-panning) 현상을 방지하기 위해, 각 크롤러/바퀴 밑바닥에 실시간 접촉 연질 그림자(`y = 0.003`, opacity 0.65)를 반드시 부착합니다.
  3. **3D 비주얼 보존 원칙**:
     - 고품질 GLB 3D 모델 외부에 튀어나오는 투박한 외부 박스나 와이어프레임을 덧대어 원래 모델을 해치는 행위를 엄격히 금지합니다.

---

## 3. 자연스러운 휠 & 무한궤도 구동 모션 (Wheel & Crawler Track Rolling Motion)
- **무한궤도(Crawler/Track) 장비**:
  - **초슬림 트랙 슈 (Ultra-thin Track Shoe Belt)**: 트랙 루프 둘레(`DX55_TRACK_LENGTH` 등)에 맞춘 두께 5~6mm의 초슬림 망간강 슈 플레이트(`InstancedMesh`)를 배치합니다.
  - **지면 상대 운동 일치**: 바닥면의 슈는 지면을 딛고 밀어내며 고정되고, 상단면은 전방으로 순환합니다.
  - **내부 스프로킷 & 롤러 회전**: 전방 아이들러 휠, 후방 구동 스프로킷, 상/하부 지지 롤러가 바퀴 반경($R$)에 따라 $\theta = \text{거리} / R$ 각속도로 동기화 회전합니다.
  - **제자리 선회 (피벗 턴)**: 좌우 궤도가 독립적으로 제어되어, 좌회전/우회전 시 각 궤도의 실제 이동량과 방향에 맞춰 정방향/역방향으로 독립 회전합니다.
- **차륜형(Wheeled) 장비**:
  - 각 휠의 구동축 회전 및 전륜 조향각(Steer Angle)을 물리적으로 연동합니다.

---

## 4. 중장비 동적 물리 및 서스펜션 관성 (Inertial Dynamics)
- **가감속 피칭 (Pitch Inertia)**:
  - 가속 출발 시 차체 후미가 가라앉는 스쿼트(Squat: `pitch > 0`).
  - 감속/급제동 시 차체 앞부분이 숙여지는 다이브(Dive: `pitch < 0`).
- **선회 원심력 롤 (Roll Inertia)**:
  - 커브 회전 시 차체가 바깥쪽으로 기울어지는 롤 모션 적용.
- **디젤 엔진 진동**:
  - 정지 시 디젤 공회전 미세 떨림(Idle tremor), 고속 주행 시 주행 진동 적용.
- **노면 자국 & 먼지 파티클**:
  - 장비의 고유 트랙 폭(Track Half-width)에 맞추어 흙길/자갈길 주행 시 궤도 스탬프(Track Marks)와 먼지 파티클을 정확한 위치에 발생시킵니다.

---

## 5. 다중 장비 동시 주행 및 충돌 방지/차간 거리 유지 (Concurrent Multi-Vehicle Driving & Collision Avoidance)
- `simulation.js`의 메인 루프에서 모든 장비의 물리 인스턴스(`VehicleMotion`)가 독립적으로 `motion.update(dt, allMotions)`를 수행합니다.
- **다중 차량 동시 파티클 비산 (`surface-effects.js`)**:
  - 특정 1대만 파티클을 뿜는 것이 아니라, 주행 중인 모든 장비의 무한궤도 폭(`halfWidthWorld`, `rearOffsetWorld`)에 맞추어 흙먼지/자갈/물 튀김/잔물결이 각 차량 뒤에서 동시에 실시간 방출됩니다.
- **차간 거리 유지 (Adaptive Follow-Distance Control)**:
  - 동일한 시험로(예: A 흙길)에 여러 대의 장비가 진입했을 때, 전방 3.2m~6.8m 이내에 선행 장비가 있으면 후행 장비가 자동으로 감속하며, 3.2m 이내로 좁혀지면 정지하여 **절대 겹치지 않고 일정한 안전 거리를 유지하며 주행**합니다.
- **교차로/합류로 양보 및 관통 방지 (Inter-vehicle Yield & Anti-clipping)**:
  - 진입로나 좁은 도로에서 장비 간 간격이 3.8m 이내로 교차할 때 상대 장비가 지나갈 때까지 대기(Yield)하여 **유령처럼 서로 겹쳐서 통과하는 현상을 100% 방지**합니다.
- 2D 캔버스 클릭 히트 타겟 및 우측 상단 장비 선택 패널(`equipment-panel.js`)에서 언제든 원하는 장비로 시점을 전환하고 주행 명령을 내릴 수 있습니다.

---

## 6. 장비 이식 가이드 (Equipment Standalone Porting Guide)
다른 프로젝트나 외부 웹 앱으로 장비 시스템만 독립 이식할 때 다음 3가지만 가져가면 됩니다:
1. **자산 폴더**: `field-simulation/assets/` 내 7대 GLB 파일 (`Bobcat T-870.glb`, `Bobcat T-76.glb`, `JohnDeere 323E.glb`, `JohnDeere 333G.glb`, `DX-55.glb`, `Yanmar ViO20.glb`, `Yanmar ViO30.glb`)
2. **로더 및 모션 모듈**:
   - `dx55-model.js`: 4K 밉맵 필터링, 접촉 그림자(AO Plane), 궤도 슈 순환 애니메이션, 바퀴 동기화, CTL/MHE 야간 라이트 일체
   - `parking-config.js`: 7대 장비별 규격 제원표(`EQUIPMENTS`)
   - `motion.js` & `surface-effects.js`: 다중 차량 차간 거리 유지, 노면별 서스펜션 관성 및 독립 파티클 엔진
3. **사용법**:
   ```javascript
   import { createGLBEquipment } from './dx55-model.js';
   import { EQUIPMENTS } from './parking-config.js';
   const model = createGLBEquipment(EQUIPMENTS['bobcat-t870']);
   scene.add(model.root);
   // 매 프레임 업데이트
   model.update(motion, isNight ? 1 : 0);
   ```

---

## 7. 작업 환경 및 테스트 동기화 원칙 (Workspace Mirroring & Verification)
1. **양방향 동기화**:
   - `C:\Users\김강현\Downloads\3D-moleding-main` (Active)
   - `F:\Workspace\3D-moleding-main` (Git Root)
   - 모든 수정 파일은 두 작업 공간에 항상 일치되도록 동기화합니다.
2. **필수 회귀 테스트**:
   - `& "F:\Tools\node-v24.21.0-win-x64\node.exe" field-simulation/tools/test-concurrent-driving.mjs`
   - `& "F:\Tools\node-v24.21.0-win-x64\node.exe" field-simulation/verification/verify.js`
   - 장비 추가 후 위 테스트가 항상 100% 통과되어야 합니다.
