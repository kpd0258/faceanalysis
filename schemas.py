# schemas.py
from pydantic import BaseModel
from typing import Optional

class ImageCreate(BaseModel):
    path: str
    filename: str

class GeometryMetricsCreate(BaseModel):
    face_ratio: float
    jaw_angle: float
    # …

class TextureMetricsCreate(BaseModel):
    avg_L: float
    L_std: float
    # …

class ColorMetricsCreate(BaseModel):
    undertone_b: float
    season_type: str
    # …

class ContextMetricsCreate(BaseModel):
    expression: str
    age_estimate: float
    # …

# 전체 응답 스키마 등 추가 정의 가능
