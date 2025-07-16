# analysis_pipeline.py

import logging
import cv2
import numpy as np

from modules.geometry             import analyze_geometry
from modules.texture              import analyze_texture
from modules.color_classification import analyze_color
from modules.context              import analyze_context

from database    import SessionLocal
from models      import (
    Image,
    GeometryMetrics,
    TextureMetrics,
    ColorMetrics,
    ContextMetrics,
)

# ─── 로거 세팅 ────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("analysis_pipeline")


def full_analysis(image_path: str, filename: str, user_info: dict = None):
    """
    비동기 백그라운드용. 
    이미지 분석 지표를 DB에 저장만 하고 리턴은 없습니다.
    
    Args:
        image_path: 이미지 파일 경로
        filename: 파일명
        user_info: 사용자 정보 (연령, 성별, 국가 등)
    """
    # 1) imdecode 방식으로 이미지 로딩 (한글 경로 지원)
    try:
        with open(image_path, "rb") as f:
            buf = f.read()
        nparr = np.frombuffer(buf, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    except Exception as e:
        logger.error(f"[analysis_pipeline] Failed to load image via imdecode: {e}")
        return

    if img is None:
        logger.error(f"[analysis_pipeline] Image load failed: {image_path}")
        return

    # 2) 모듈별 분석 실행 (사용자 정보 활용)
    try:
        geom = analyze_geometry(img, user_info)
    except Exception as e:
        logger.error(f"[analysis_pipeline] Geometry analysis failed: {e}")
        geom = {}
        
    try:
        tex = analyze_texture(img, user_info)
    except Exception as e:
        logger.error(f"[analysis_pipeline] Texture analysis failed: {e}")
        tex = {}
        
    try:
        col = analyze_color(img, user_info)
    except Exception as e:
        logger.error(f"[analysis_pipeline] Color analysis failed: {e}")
        col = {}
        
    try:
        ctx = analyze_context(img, user_info)
    except Exception as e:
        logger.error(f"[analysis_pipeline] Context analysis failed: {e}")
        ctx = {}

    # 3) 결과를 DB에 저장
    db = SessionLocal()

    # ── Image 레코드 확보 ────────────────────────────
    record = db.query(Image).filter_by(path=image_path).first()
    if not record:
        record = Image(path=image_path, filename=filename)
        db.add(record)
        db.commit()
        db.refresh(record)

    img_id = record.id

    # ── GeometryMetrics ─────────────────────────────
    if geom:
        gm = db.query(GeometryMetrics).filter_by(image_id=img_id).first()
        if not gm:
            gm = GeometryMetrics(image_id=img_id, **geom)
            db.add(gm)
        else:
            for k, v in geom.items():
                setattr(gm, k, v)

    # ── TextureMetrics ──────────────────────────────
    if tex:
        tm = db.query(TextureMetrics).filter_by(image_id=img_id).first()
        if not tm:
            tm = TextureMetrics(image_id=img_id, **tex)
            db.add(tm)
        else:
            for k, v in tex.items():
                setattr(tm, k, v)

    # ── ColorMetrics ────────────────────────────────
    if col:
        cm = db.query(ColorMetrics).filter_by(image_id=img_id).first()
        if not cm:
            cm = ColorMetrics(image_id=img_id, **col)
            db.add(cm)
        else:
            for k, v in col.items():
                setattr(cm, k, v)

    # ── ContextMetrics ──────────────────────────────
    if ctx:
        xm = db.query(ContextMetrics).filter_by(image_id=img_id).first()
        if not xm:
            xm = ContextMetrics(image_id=img_id, **ctx)
            db.add(xm)
        else:
            for k, v in ctx.items():
                setattr(xm, k, v)

    db.commit()
    db.close()

    logger.debug("[analysis_pipeline] full_analysis finished")


def to_dict(obj):
    """
    SQLAlchemy 인스턴스를 dict로 변환.
    obj가 None이면 빈 dict 반환.
    """
    if obj is None:
        return {}
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


def full_analysis_sync(image_path: str, filename: str, user_info: dict = None) -> dict:
    """
    동기 호출용:
    1) full_analysis 실행
    2) DB에서 방금 저장된 레코드를 조회하여 리턴
    
    Args:
        image_path: 이미지 파일 경로
        filename: 파일명
        user_info: 사용자 정보 (연령, 성별, 국가 등)
    """
    # 1) 분석 실행
    full_analysis(image_path, filename, user_info)

    # 2) DB에서 결과 조회
    db = SessionLocal()
    # filename 기준 최신 레코드 찾기
    img = (
        db.query(Image)
        .filter_by(filename=filename)
        .order_by(Image.id.desc())
        .first()
    )
    if not img:
        logger.error("[analysis_pipeline] Image record not found after analysis")
        db.close()
        return {}

    image_id = img.id

    geom = db.query(GeometryMetrics).filter_by(image_id=image_id).first()
    tex  = db.query(TextureMetrics ).filter_by(image_id=image_id).first()
    col  = db.query(ColorMetrics   ).filter_by(image_id=image_id).first()
    ctx  = db.query(ContextMetrics ).filter_by(image_id=image_id).first()
    db.close()

    return {
        "geometry": to_dict(geom),
        "texture":  to_dict(tex),
        "color":    to_dict(col),
        "context":  to_dict(ctx),
    }
