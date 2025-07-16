from fastapi import FastAPI, UploadFile, File, Request, BackgroundTasks, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
import shutil
from datetime import datetime
import logging

from database import SessionLocal, engine, Base
from models import Image, GeometryMetrics, TextureMetrics, ColorMetrics, ContextMetrics, UserSession
from analysis_pipeline import full_analysis, full_analysis_sync

app = FastAPI()

# ▶ 앱 시작 시 테이블이 없으면 자동 생성
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


# ▶ CORS (모든 출처 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ▶ 업로드 폴더 준비 및 정적 파일 제공
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ▶ 정적 파일 제공 (프론트엔드)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Expo 웹 빌드 정적 파일 서빙
import os

# /camera/_expo/static/... 경로를 정적으로 서빙
app.mount("/camera/_expo/static", StaticFiles(directory="automakersceo/dist/_expo/static"), name="expo_static")
# /_expo/static/... 경로도 정적으로 서빙 (index.html 내부 경로 대응)
app.mount("/_expo/static", StaticFiles(directory="automakersceo/dist/_expo/static"), name="expo_static_root")

@app.get("/camera")
async def camera_index():
    """
    /camera 경로에서 Expo 웹 빌드 index.html 제공 (절대경로 사용)
    """
    index_path = Path(__file__).parent / "automakersceo" / "dist" / "index.html"
    return FileResponse(str(index_path))

@app.get("/")
async def read_index():
    """
    루트 경로에서 index.html 제공
    """
    return FileResponse("automakersceo/index.html")

@app.get("/api/health")
def read_root():
    return {"detail": "Hello, the API is up and running!"}

def _save_and_get_image_record(category: str, file: UploadFile, request: Request):
    # 1) 카테고리별 폴더 생성
    category_dir = UPLOAD_DIR / category
    category_dir.mkdir(parents=True, exist_ok=True)

    # 2) 파일 디스크에 저장
    dest = category_dir / file.filename
    try:
        with open(dest, "wb") as buf:
            shutil.copyfileobj(file.file, buf)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File save failed: {str(e)}")

    # 3) DB에서 중복 path 체크 → 신규 or 기존 레코드
    db = SessionLocal()
    try:
        img = db.query(Image).filter_by(path=str(dest)).first()
        if not img:
            img = Image(path=str(dest), filename=file.filename)
            db.add(img)
            db.commit()
            db.refresh(img)
        image_id = img.id
    except Exception as e:
        db.rollback()
        db.close()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        db.close()

    # 4) public URL 생성
    fwd_h = request.headers.get("x-forwarded-host")
    fwd_p = request.headers.get("x-forwarded-proto")
    host   = fwd_h if fwd_h else request.url.hostname
    scheme = fwd_p if fwd_p else request.url.scheme
    url    = f"{scheme}://{host}/uploads/{category}/{file.filename}"

    return image_id, url


@app.post("/upload/{category}")
async def upload_file(
    category: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    request: Request = None
):
    """
    비동기 업로드 → BackgroundTasks로 full_analysis 실행
    """
    image_id, url = _save_and_get_image_record(category, file, request)
    background_tasks.add_task(
        full_analysis,
        str(UPLOAD_DIR / category / file.filename),
        file.filename
    )
    return {
        "detail":   "Success",
        "image_id": image_id,
        "path":     f"{category}/{file.filename}",
        "url":      url
    }


@app.post("/save_user_data")
async def save_user_data(request: Request):
    """
    사용자 세션 데이터 저장
    """
    try:
        data = await request.json()
        db = SessionLocal()
        
        # 기존 세션 확인
        session = db.query(UserSession).filter_by(session_id=data["session_id"]).first()
        
        if session:
            # 기존 세션 업데이트
            session.birth_year = data.get("birth_year")
            session.birth_month = data.get("birth_month")
            session.gender = data.get("gender")
            session.country = data.get("country")
            session.step = data.get("step", 1)
            session.updated_at = str(datetime.now())
        else:
            # 새 세션 생성
            session = UserSession(
                session_id=data["session_id"],
                birth_year=data.get("birth_year"),
                birth_month=data.get("birth_month"),
                gender=data.get("gender"),
                country=data.get("country"),
                step=data.get("step", 1)
            )
            db.add(session)
        
        db.commit()
        db.close()
        
        return {"detail": "User data saved successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save user data: {str(e)}")


@app.post("/upload_sync/{category}")
def upload_and_analyze_sync(
    category: str,
    file: UploadFile = File(...),
    request: Request = None
):
    """
    동기 업로드 + 즉시 full_analysis_sync 실행 → 결과 반환
    """
    image_id, url = _save_and_get_image_record(category, file, request)
    
    # 사용자 정보 추출 (세션에서)
    user_info = None
    try:
        # 세션 ID를 헤더에서 추출하거나 쿼리 파라미터에서 추출
        session_id = request.query_params.get('session_id')
        if session_id:
            db = SessionLocal()
            user_session = db.query(UserSession).filter_by(session_id=session_id).first()
            if user_session:
                user_info = {
                    'birth_year': user_session.birth_year,
                    'birth_month': user_session.birth_month,
                    'gender': user_session.gender,
                    'country': user_session.country,
                    'age': 2024 - user_session.birth_year if user_session.birth_year else None
                }
            db.close()
    except Exception as e:
        logging.error(f"Failed to get user info: {e}")
    
    metrics = full_analysis_sync(
        str(UPLOAD_DIR / category / file.filename),
        file.filename,
        user_info
    )
    return {
        "detail":   "Success",
        "image_id": image_id,
        "path":     f"{category}/{file.filename}",
        "url":      url,
        "metrics":  metrics
    }


@app.post("/analyze_face_directions")
async def analyze_face_directions(
    direction: str = Form(...),
    file: UploadFile = File(...),
    request: Request = None
):
    """
    얼굴 각도(좌/정/우)별 이미지 업로드 및 동기 분석 후 결과 반환
    direction: '좌측' | '정면' | '우측'
    """
    category = "face_direction"
    image_id, url = _save_and_get_image_record(category, file, request)
    # 사용자 정보 추출(옵션)
    user_info = None
    try:
        session_id = request.query_params.get('session_id')
        if session_id:
            db = SessionLocal()
            user_session = db.query(UserSession).filter_by(session_id=session_id).first()
            if user_session:
                user_info = {
                    'birth_year': user_session.birth_year,
                    'birth_month': user_session.birth_month,
                    'gender': user_session.gender,
                    'country': user_session.country,
                    'age': 2024 - user_session.birth_year if user_session.birth_year else None
                }
            db.close()
    except Exception as e:
        logging.error(f"Failed to get user info: {e}")
    # 분석 실행
    metrics = full_analysis_sync(
        str(UPLOAD_DIR / category / file.filename),
        file.filename,
        user_info
    )
    return {
        "detail":   "Success",
        "direction": direction,
        "image_id": image_id,
        "path":     f"{category}/{file.filename}",
        "url":      url,
        "metrics":  metrics
    }


@app.get("/metrics/{image_id}")
def get_metrics(image_id: int):
    """
    저장된 4개 metrics 테이블 조회 후 JSON 리턴
    """
    db = SessionLocal()
    try:
        geom = db.query(GeometryMetrics).filter_by(image_id=image_id).first()
        tex = db.query(TextureMetrics ).filter_by(image_id=image_id).first()
        col = db.query(ColorMetrics   ).filter_by(image_id=image_id).first()
        ctx = db.query(ContextMetrics ).filter_by(image_id=image_id).first()
        
        if not any([geom, tex, col, ctx]):
            raise HTTPException(status_code=404, detail="metrics not found")

        def to_dict(o):
            if o is None:
                return {}
            d = o.__dict__.copy()
            d.pop("_sa_instance_state", None)
            return d

        return {
            "geometry": to_dict(geom),
            "texture":  to_dict(tex),
            "color":    to_dict(col),
            "context":  to_dict(ctx),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        db.close()
