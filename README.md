# 얼굴 분석 시스템

이 프로젝트는 이미지에서 얼굴을 분석하여 기하학적 특성, 질감, 색상, 컨텍스트 정보를 추출하는 시스템입니다.

## 주요 기능

- **기하학적 분석**: 얼굴 비율, 대칭성, 눈/코/입 측정
- **질감 분석**: 피부 질감, 모공, 주름 밀도 분석
- **색상 분석**: 퍼스널 컬러, 언더톤, 시즌 분석
- **컨텍스트 분석**: 표정, 나이 추정, 안경 감지

## 설치 및 실행

### 1. 의존성 설치
```bash
pip install -r requirements.txt
```

### 2. 환경 설정
```bash
# config.env 파일 생성 (선택사항)
DATABASE_URL=sqlite:///./analysis.db
```

### 3. 서버 실행
```bash
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

## API 엔드포인트

### 이미지 업로드 (비동기)
```bash
POST /upload/{category}
```

### 이미지 업로드 + 즉시 분석 (동기)
```bash
POST /upload_sync/{category}
```

### 분석 결과 조회
```bash
GET /metrics/{image_id}
```

## 프로젝트 구조

```
workspace/
├── analysis_pipeline.py    # 메인 분석 파이프라인
├── database.py            # 데이터베이스 설정
├── models.py              # SQLAlchemy 모델
├── server.py              # FastAPI 서버
├── schemas.py             # Pydantic 스키마
├── modules/
│   ├── geometry.py        # 기하학적 분석
│   ├── texture.py         # 질감 분석
│   ├── color_classification.py  # 색상 분석
│   └── context.py         # 컨텍스트 분석
├── config/
│   └── config.yaml        # 설정 파일
└── uploads/               # 업로드된 이미지 저장소
```

## 데이터베이스 스키마

- **images**: 이미지 메타데이터
- **geometry_metrics**: 기하학적 측정값
- **texture_metrics**: 질감 분석 결과
- **color_metrics**: 색상 분석 결과
- **context_metrics**: 컨텍스트 정보

## 개발 가이드

### 새로운 분석 모듈 추가
1. `modules/` 폴더에 새 모듈 생성
2. `models.py`에 해당 메트릭 모델 추가
3. `analysis_pipeline.py`에서 모듈 호출 추가

### 설정 변경
`config/config.yaml` 파일에서 데이터베이스 URL, 모델 설정 등을 변경할 수 있습니다.

## 라이선스

MIT License
