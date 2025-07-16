# create_tables.py
from database import Base, engine, SessionLocal
import os

# 1) 실제 사용하는 DB URL 출력
try:
    from database import DATABASE_URL
    print("🔍 DATABASE_URL =", DATABASE_URL)
except ImportError:
    print("⚠️ DATABASE_URL 변수가 database.py에 정의되어 있지 않습니다.")

# 2) SQLAlchemy가 인식하고 있는 모델(테이블) 목록 출력
print("🔍 SQLAlchemy 모델로 정의된 테이블들:", list(Base.metadata.tables.keys()))

# 3) 테이블 생성
Base.metadata.create_all(bind=engine)
print("✅ Base.metadata.create_all() 호출됨")
print("🔍 실제 파일 위치:", os.path.abspath("analysis.db"))
