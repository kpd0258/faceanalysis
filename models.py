# models.py
from sqlalchemy import Column, Integer, String, Float, ForeignKey
from database import Base
from datetime import datetime

class Image(Base):
    __tablename__ = "images"
    id       = Column(Integer, primary_key=True, index=True)
    path     = Column(String, unique=True, index=True, nullable=False)
    filename = Column(String, nullable=False)

# 2. 얼굴형·비율 (≈20개)
class GeometryMetrics(Base):
    __tablename__ = "geometry_metrics"
    id                     = Column(Integer, primary_key=True)
    image_id               = Column(Integer, ForeignKey("images.id"), nullable=False)
    face_ratio             = Column(Float)  # 얼굴 길이/너비
    cranio_mandibular_ratio= Column(Float)  # 정수리~턱 길이 비율
    forehead_ratio         = Column(Float)  # 이마 높이/너비
    symmetry_score         = Column(Float)  # 좌우 대칭도
    jaw_angle_left         = Column(Float)
    jaw_angle_right        = Column(Float)
    cheekbone_width        = Column(Float)
    eye_width_left         = Column(Float)
    eye_height_left        = Column(Float)
    eye_aspect_ratio_left  = Column(Float)
    eye_width_right        = Column(Float)
    eye_height_right       = Column(Float)
    eye_aspect_ratio_right = Column(Float)
    interocular_distance   = Column(Float)
    eye_tilt_angle_left    = Column(Float)
    eye_tilt_angle_right   = Column(Float)
    eye_position_ratio_left = Column(Float)
    eye_position_ratio_right = Column(Float)
    nose_length_ratio      = Column(Float)
    nose_width_ratio       = Column(Float)
    nose_bridge_angle      = Column(Float)
    mouth_width_ratio      = Column(Float)
    mouth_height           = Column(Float)
    # 추가 필드들
    face_width             = Column(Float)  # 얼굴 너비
    face_height            = Column(Float)  # 얼굴 높이
    eye_size               = Column(Float)  # 눈 크기
    eye_size_label         = Column(String) # 눈 크기 라벨
    nose_width             = Column(Float)  # 코 너비
    lip_thickness          = Column(Float)  # 입술 두께
    face_shape             = Column(String) # 얼굴형

# 3. 윤곽·피부 질감 (≈15개)
class TextureMetrics(Base):
    __tablename__ = "texture_metrics"
    id              = Column(Integer, primary_key=True, index=True)
    image_id        = Column(Integer, ForeignKey("images.id"), nullable=False)
    avg_L           = Column(Float)
    std_L           = Column(Float)
    std_L_level     = Column(Integer)  # 1~10
    avg_chroma      = Column(Float)
    chroma_level    = Column(Integer)  # 1~10
    pore_ratio      = Column(Float)
    wrinkle_density = Column(Float)
    spot_ratio      = Column(Float)
    sebum_ratio     = Column(Float)
    convexity       = Column(Float)
    mean_curvature  = Column(Float)
    jaw_forehead_curvature = Column(Float)

# 4. 퍼스널 컬러 (≈20개)
class ColorMetrics(Base):
    __tablename__ = "color_metrics"
    id             = Column(Integer, primary_key=True, index=True)
    image_id       = Column(Integer, ForeignKey("images.id"), nullable=False)
    skin_cluster_rgb   = Column(String)  # JSON list
    skin_cluster_lab   = Column(String)
    undertone_b        = Column(Float)
    is_warm            = Column(Integer) 
    is_cool            = Column(Integer)
    lightness_contrast = Column(Float)
    iris_cluster_rgb   = Column(String)
    iris_luminance_contrast = Column(Float)
    hair_hue_mean      = Column(Float)
    hair_chroma_ratio  = Column(Float)
    season             = Column(String)

# 5. 추가 인식·컨텍스트 (≈15개)
class ContextMetrics(Base):
    __tablename__ = "context_metrics"
    id               = Column(Integer, primary_key=True, index=True)
    image_id         = Column(Integer, ForeignKey("images.id"), nullable=False)
    expression       = Column(String)
    age_estimate     = Column(Float)
    gender_prob      = Column(Float)
    glasses          = Column(Float)
    earring          = Column(Float)
    lens_color       = Column(String)
    makeup_intensity = Column(Float)
    light_direction  = Column(String)
    yaw              = Column(Float)
    pitch            = Column(Float)
    roll             = Column(Float)

# 사용자 세션 데이터
class UserSession(Base):
    __tablename__ = "user_sessions"
    id           = Column(Integer, primary_key=True, index=True)
    session_id   = Column(String, unique=True, index=True, nullable=False)
    birth_year   = Column(Integer)
    birth_month  = Column(Integer)
    gender       = Column(String)
    country      = Column(String)
    step         = Column(Integer, default=1)
    created_at   = Column(String, default=lambda: str(datetime.now()))
    updated_at   = Column(String, default=lambda: str(datetime.now()))
