from fastapi import FastAPI, UploadFile, File, Request, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
import shutil
from datetime import datetime

from database import SessionLocal, engine, Base
from models import Image, UserSession

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
app.mount("/static", StaticFiles(directory="static", html=True), name="static")

@app.get("/")
def root():
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
    request: Request,
    file: UploadFile = File(...)
):
    """
    비동기 업로드 (분석 없이 파일만 저장)
    """
    image_id, url = _save_and_get_image_record(category, file, request)
    return {
        "detail":   "Success",
        "image_id": image_id,
        "path":     f"{category}/{file.filename}",
        "url":      url
    }

@app.post("/upload_sync/{category}")
def upload_and_analyze_sync(
    category: str,
    request: Request,
    file: UploadFile = File(...)
):
    """
    동기 업로드 (분석 없이 파일만 저장)
    """
    image_id, url = _save_and_get_image_record(category, file, request)
    
    # 임시 분석 결과 (실제 분석 없이 더미 데이터)
    dummy_metrics = {
        "geometry": {
            "face_ratio": 1.2,
            "symmetry_score": 0.85,
            "eye_width_left": 25.5,
            "eye_width_right": 25.3
        },
        "texture": {
            "avg_L": 65.2,
            "std_L": 12.5,
            "pore_ratio": 0.15,
            "wrinkle_density": 0.08
        },
        "color": {
            "undertone_b": 5.2,
            "season": "Spring Light",
            "is_warm": 1
        },
        "context": {
            "expression": "neutral",
            "age_estimate": 28.5,
            "gender_prob": 0.6
        }
    }
    
    return {
        "detail":   "Success",
        "image_id": image_id,
        "path":     f"{category}/{file.filename}",
        "url":      url,
        "metrics":  dummy_metrics
    }

@app.get("/metrics/{image_id}")
def get_metrics(image_id: int):
    """
    저장된 metrics 테이블 조회 후 JSON 리턴 (더미 데이터)
    """
    # 임시 더미 데이터 반환
    dummy_metrics = {
        "geometry": {
            "face_ratio": 1.2,
            "symmetry_score": 0.85,
            "eye_width_left": 25.5,
            "eye_width_right": 25.3,
            "nose_length_ratio": 0.35,
            "mouth_width_ratio": 0.42
        },
        "texture": {
            "avg_L": 65.2,
            "std_L": 12.5,
            "pore_ratio": 0.15,
            "wrinkle_density": 0.08,
            "spot_ratio": 0.03,
            "sebum_ratio": 0.12
        },
        "color": {
            "undertone_b": 5.2,
            "season": "Spring Light",
            "is_warm": 1,
            "is_cool": 0,
            "lightness_contrast": 15.3
        },
        "context": {
            "expression": "neutral",
            "age_estimate": 28.5,
            "gender_prob": 0.6,
            "glasses": 0.0,
            "earring": 0.0
        }
    }
    
    return dummy_metrics

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