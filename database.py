# database.py
from dotenv import load_dotenv
import os, yaml
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 1) .env 로딩 (환경변수 덮어쓰기 용)
load_dotenv()

# 2) config.yaml 로딩
cfg_path = os.path.join(os.path.dirname(__file__), "config", "config.yaml")
with open(cfg_path, "r", encoding="utf-8") as f:
    cfg = yaml.safe_load(f)

# 3) 우선순위: 환경변수(DATABASE_URL) > YAML (database.url)
DATABASE_URL = os.getenv("DATABASE_URL") or cfg["database"]["url"]

# 4) SQLAlchemy 엔진 & 세션 설정
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 5) Declarative base
Base = declarative_base()

# 6) 모델 임포트해서 metadata 준비 (순환 import 방지)
def create_tables():
    from models import Image, GeometryMetrics, TextureMetrics, ColorMetrics, ContextMetrics, UserSession  # noqa
    Base.metadata.create_all(bind=engine)

# 7) **앱 시작 시 자동으로 테이블 생성**
create_tables()
