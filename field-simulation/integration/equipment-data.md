# 장비 정보 저장과 Home 연결

현재 장비 ID는 `bobcat-t870`, 주차 위치는 `P03`입니다. 화면의 이름·노면 이름은 표시 값이며 저장 키로 쓰지 않습니다.

## 저장 데이터

`node server.mjs`가 프로젝트 루트의 `data/equipment.json`에 저장합니다. 이 디렉터리는 Git에서 제외되며 정적 HTTP 파일로 노출하지 않습니다. 브라우저 저장에 의존하지 않으므로 새로고침·서버 재시작 뒤에도 같은 파일에서 복원합니다. 사용자 입력이 없는 첫 실행은 기본값을 읽으며, 처음 저장할 때 파일을 만듭니다.

- `purpose`: 시험 목적
- `testHours`: 직접 입력하는 진행시간, 단위 hrs
- `testStatus`: `waiting`(대기중) / `running`(진행중), 직접 선택하는 시험 상태
- `tracks.left`, `tracks.right`: 좌·우 트랙 제품명/규격 등
- `surfaceHours.general`, `gravel`, `concrete`: 직접 입력하는 노면별 시간, 단위 hrs
- `id`, `name`, `parkingSlotId`: 장비 식별·표시·주차 위치
- `revision`, `updatedAt`: 저장 버전과 수정 시각

시간은 주행 애니메이션이나 1~10배 재생으로 누적되지 않습니다. 시험 상태도 카드에서 입력하는 정보입니다. 재실행 시 시험 정보는 복원하고 3D 장비는 P에 주차한 상태에서 시작합니다.

## 저장 API

- `GET /api/equipment`: 장비 목록
- `GET /api/equipment/bobcat-t870`: 단일 장비
- `PATCH /api/equipment/bobcat-t870`: `{"revision":0,"patch":{"testHours":12.5}}`

저장 성공 응답은 갱신된 전체 장비 정보입니다. 잘못된 입력은 400, 오래된 버전으로 덮어쓰기는 409로 거절합니다. 쓰기는 직렬화하고 임시 파일을 원자적으로 교체합니다. 손상된 저장 파일을 기본값으로 덮어쓰지 않습니다.

카드는 입력 후 자동 저장과 수동 저장 버튼을 제공합니다. 성공 응답을 받은 뒤에만 저장 완료로 표시합니다. 저장에 실패하면 입력을 유지하며, 미저장 상태에서 닫기를 누르면 저장을 시도하고 실패한 카드를 그대로 둡니다.

## Home으로 이전할 때

현재 TrackVision 앱 원본은 변경하지 않았습니다. 데이터가 유지되려면 프런트엔드뿐 아니라 저장 파일과 API를 함께 연결해야 합니다.

1. 현재 서버를 정상 종료하고 `data/equipment.json`을 백업합니다.
2. 새 서버에서도 같은 장비 ID와 스키마로 이 파일을 읽거나, Home DB의 동일 장비 ID에 필드를 이관합니다.
3. 저장 API를 포함한 필드 화면 전체를 Home에 iframe으로 연결하는 방식이 가장 간단합니다. 로컬에서만 사용하는 예:

```python
from ui.field_motion import field_motion
field_motion(frontend_url="http://127.0.0.1:8521/field-simulation/index.html")
```

배포 환경에서는 클라이언트의 localhost를 가리키지 않도록 Home의 같은 HTTPS 호스트 아래에 필드 서버를 프록시합니다.

4. 별도 저장소를 사용할 때는 `equipment-client.js`의 `load(id)` / `save(id, patch, revision)` 인터페이스에 맞춥니다. 모듈을 읽기 전에 `window.TrackVisionConfig.equipmentApiBase`를 같은 출처의 프록시 경로로 설정할 수도 있습니다.
5. 이전 전 입력한 목적·시간·상태·트랙·노면 정보가 모두 같고 다시 저장되는지 확인합니다.

기존의 정적 Streamlit 컴포넌트 파일 복사만으로 저장 API까지 복제되지는 않습니다. 저장 서버가 없는 경우 카드가 연결 오류를 명시하며 저장됐다고 표시하지 않습니다.
