# TrackVision AI — 3D Modeling & Interactive Simulation Assets

본 레포지토리는 **TrackVision AI**의 차세대 인터랙티브 홈 화면(디지털 트윈 관제 대시보드)에 적용될 **3D 시뮬레이션 지형 맵 및 건설 시험 장비 3D 미니어처/모션 에셋**을 독립적으로 연구·제작하는 저장소입니다.

향후 완성된 3D 엔진 및 에셋 모듈은 메인 프로젝트인 [TrackVision_AI](https://github.com/Kanghyun96/TrackVision_AI)로 이식되어 결합됩니다.

---

## 📁 주요 구성 파일

```text
3D-moleding/
├── index.html                   # 웹 배포/실행용 진입 파일 (Home 관제맵)
├── home_fullscreen_map.html     # 필드시험장 5-Layer 관제맵 (실시간 CTL 주행 & 흙먼지 모션)
├── preview_ctl_3d.html          # Bobcat CTL 3D 미니어처 360° 인터랙티브 뷰어 스튜디오
├── prototype_field.html         # 초기 뷰포트 레이아웃 프로토타입
└── picture/
    ├── trackvision_terrain_3d_sim.jpg                  # 3D 시뮬레이션 톤 필드시험장 배경
    ├── bobcat_ctl_ref.jpg                              # Bobcat CTL 다각도 레퍼런스 시트
    └── trackvision_terrain_refined_clean_1793842243066.jpg # 초기 시험장 원본 이미지
```

---

## 🚀 주요 기능 및 핵심 아키텍처

### 1. 필드시험장 5-Layer 관제맵 (`home_fullscreen_map.html`)
* **Layer 1**: 3D 시뮬레이션 톤 고해상도 시험장 배경
* **Layer 2**: 장비 이동 경로(SVG Path)
* **Layer 3**: Bobcat CTL 실시간 3D 궤도 주행 및 흙먼지(Dust Particle) 흩날림 물리 모션
* **Layer 4**: 차고지(Panorama 연동), 사무실(Report Studio 연동) 인터랙티브 영역 (대기)
* **Layer 5**: 우측 상단 실시간 관제 현황 및 시험시간 정보 HUD 카드

### 2. Bobcat CTL 3D 미니어처 엔진 (`preview_ctl_3d.html`)
* **Pure Vanilla JS & Canvas 3D**: 무거운 외부 라이브러리/GLB 없이 60fps 고정 구동
* **실시간 360° 회전 및 8방향 프리셋**
* **순백색 하이키 셰이딩** 및 3D 폴리곤 UV 클리핑 기반의 **Bobcat 고양이 심볼 & 타이포그래피** 정밀 렌더링
* **고무트랙 주행 회전** 및 **리프트 암/버킷 승강 조작**
