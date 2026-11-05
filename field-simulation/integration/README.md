# Streamlit Home 연결

`field-simulation/`의 실행 파일을 대상 앱의 `ui/field_frontend/`에 복사하고,
이 폴더의 `field_motion.py`를 대상 앱의 `ui/field_motion.py`로 복사합니다.

실행 파일 목록은 `frontend-manifest.json`에 있습니다. 각 파일의 SHA-256도 함께 기록했습니다.
`verification/`, `integration/`, `archive/`는 프런트엔드 배포에 필요하지 않습니다.

Home을 표시하는 함수 안에 다음 두 줄을 추가합니다.

```python
from ui.field_motion import field_motion
field_motion()
```

컴포넌트는 화면 높이만 Streamlit에 전달합니다. 작업 분석, 이력, 보고서,
내비게이션, 세션 상태를 바꾸는 값을 전달하지 않습니다.

로컬에서 적용할 때 만든 앱 원본 백업과 설치 스크립트는 `.gitignore`로 제외합니다.
