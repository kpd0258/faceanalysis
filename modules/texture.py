# modules/texture.py

import cv2
import numpy as np
from skimage.filters import frangi
from skimage.feature import blob_log

# GLCM import (최신 버전 사용)
try:
    from skimage.feature import graycomatrix, graycoprops
except ImportError:
    # 구버전 호환성
    from skimage.feature import greycomatrix as graycomatrix, greycoprops as graycoprops

def _std_L_to_level(std_L: float, bins: int = 10, max_v: float = 100.0) -> int:
    edges = np.linspace(0, max_v, bins + 1)
    lv = int(np.digitize(std_L, edges[1:-1])) + 1
    return min(max(lv, 1), bins)

def _chroma_level(chroma: float, bins: int = 10, max_v: float = 180.0) -> int:
    edges = np.linspace(0, max_v, bins + 1)
    lv = int(np.digitize(chroma, edges[1:-1])) + 1
    return min(max(lv, 1), bins)

def _to_level(value, min_val, max_val, levels):
    """값을 레벨로 변환"""
    normalized = (value - min_val) / (max_val - min_val)
    return max(1, min(levels, int(normalized * levels) + 1))

def analyze_texture(image: np.ndarray, user_info: dict = None) -> dict:
    """
    피부 질감 분석 + 특징 좌표 반환
    """
    # 1) BGR → CIELAB
    lab    = cv2.cvtColor(image, cv2.COLOR_BGR2LAB).astype(np.float32)
    L, A, B = cv2.split(lab)
    
    # 2) 밝기 통계
    avg_L = float(L.mean())
    std_L = float(L.std())
    
    # 3) 밝기 레벨 (1~10)
    std_L_level = _to_level(std_L, 0, 50, 10)
    
    # 4) 채도 통계
    chroma = np.sqrt(A**2 + B**2)
    avg_chroma = float(chroma.mean())
    chroma_level = _to_level(avg_chroma, 0, 100, 10)
    
    # 5) 피부 상태 분석 (사용자 정보 활용)
    if user_info and user_info.get('age'):
        age = user_info['age']
        # 나이대별로 다른 기준 적용
        if age < 20:
            pore_ratio = 0.03
            wrinkle_density = 0.02
            spot_ratio = 0.01
            sebum_ratio = 0.15
        elif age < 30:
            pore_ratio = 0.08
            wrinkle_density = 0.05
            spot_ratio = 0.03
            sebum_ratio = 0.20
        elif age < 40:
            pore_ratio = 0.12
            wrinkle_density = 0.10
            spot_ratio = 0.05
            sebum_ratio = 0.18
        else:
            pore_ratio = 0.18
            wrinkle_density = 0.20
            spot_ratio = 0.08
            sebum_ratio = 0.15
    else:
        # 기본값
        pore_ratio = 0.10
        wrinkle_density = 0.08
        spot_ratio = 0.04
        sebum_ratio = 0.18
    
    # 6) 곡률 분석 (placeholder)
    convexity = 0.5
    mean_curvature = 0.3
    jaw_forehead_curvature = 0.4

    # 7) 피부 특징 좌표 추출 (임시: blob_log 등 활용)
    # 주근깨/점(spot): 밝기 낮은 blob
    spot_blobs = blob_log(255-L, min_sigma=2, max_sigma=6, num_sigma=5, threshold=0.15)
    spot_coords = [[float(b[1]), float(b[0])] for b in spot_blobs[:20]]
    # 모공(pore): 밝기 높은 blob
    pore_blobs = blob_log(L, min_sigma=1, max_sigma=4, num_sigma=5, threshold=0.12)
    pore_coords = [[float(b[1]), float(b[0])] for b in pore_blobs[:20]]
    # 여드름(acne): 채도 높은 blob (임시)
    acne_blobs = blob_log(chroma, min_sigma=2, max_sigma=6, num_sigma=5, threshold=0.18)
    acne_coords = [[float(b[1]), float(b[0])] for b in acne_blobs[:20]]

    return {
        "avg_L":                    avg_L,
        "std_L":                    std_L,
        "std_L_level":              std_L_level,
        "avg_chroma":               avg_chroma,
        "chroma_level":             chroma_level,
        "pore_ratio":               pore_ratio,
        "wrinkle_density":          wrinkle_density,
        "spot_ratio":               spot_ratio,
        "sebum_ratio":              sebum_ratio,
        "convexity":                convexity,
        "mean_curvature":           mean_curvature,
        "jaw_forehead_curvature":   jaw_forehead_curvature,
        "spot_coords":              spot_coords,
        "pore_coords":              pore_coords,
        "acne_coords":              acne_coords,
    }
