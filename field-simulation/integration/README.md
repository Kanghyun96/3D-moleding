# Streamlit Home 연결

장비 카드의 저장 기능은 정적 파일 외에 `server.mjs`의 저장 API가 필요합니다. 현재 권장 연결과 데이터 보존 절차는 [장비 정보 저장과 Home 연결](equipment-data.md)을 먼저 확인하세요. 기존 TrackVision 앱은 이번 작업에서 수정하지 않았습니다.

`field_motion(frontend_url="필드 서버의 화면 URL")`로 화면과 저장 API를 함께 연결할 수 있습니다. 로컬 시험은 `http://127.0.0.1:8521/field-simulation/index.html`, 배포는 Home과 같은 출처의 HTTPS 프록시 URL을 사용합니다.

`field-simulation/`의 실행 파일을 대상 앱의 `ui/field_frontend/`에 복사하고,
이 폴더의 `field_motion.py`를 대상 앱의 `ui/field_motion.py`로 복사합니다.

실행 파일 목록은 `frontend-manifest.json`에 있습니다. 각 파일의 SHA-256도 함께 기록했습니다.
`verification/`, `integration/`, `archive/`는 프런트엔드 배포에 필요하지 않습니다.

Home을 표시하는 함수 안에 다음 두 줄을 추가합니다.

```python
from ui.field_motion import field_motion
field_motion()
```

기존 정적 컴포넌트 방식은 화면 높이만 Streamlit에 전달합니다. 작업 분석, 이력, 보고서,
내비게이션, 세션 상태를 바꾸는 값을 전달하지 않습니다.

로컬에서 적용할 때 만든 앱 원본 백업과 설치 스크립트는 `.gitignore`로 제외합니다.
