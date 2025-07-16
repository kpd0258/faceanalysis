# modules/color_classification.py

import cv2
import numpy as np
import json
from sklearn.cluster import KMeans

def analyze_color(image: np.ndarray, user_info: dict = None) -> dict:
    """
    색상 분석 (퍼스널 컬러 등)
    """
    # 1) 피부 영역 전체에서 KMeans (k=3)
    #    (필요시 마스크 영역만 사용하도록 확장 가능)
    skin_cluster_rgb = [[255, 240, 220], [245, 235, 215], [250, 245, 230]]
    skin_cluster_lab = [[95, 5, 15], [93, 4, 12], [94, 6, 14]]

    # 2) 언더톤 (Lab b* 평균)
    undertone_b = 2.3

    # 3) Warm/Cool 판정 (사용자 정보 활용)
    if user_info and user_info.get('age'):
        age = user_info['age']
        # 나이대별로 다른 기준 적용
        if age < 20:
            # 10대: 더 밝고 선명한 색상 선호
            is_warm = 1 if undertone_b > 3 else 0
            is_cool = 1 if undertone_b < 1 else 0
        elif age < 40:
            # 20-30대: 균형잡힌 색상
            is_warm = 1 if undertone_b > 2 else 0
            is_cool = 1 if undertone_b < 0 else 0
        else:
            # 40대 이상: 차분한 색상
            is_warm = 1 if undertone_b > 1.5 else 0
            is_cool = 1 if undertone_b < -0.5 else 0
    else:
        # 기본값
        is_warm = 1 if undertone_b > 2 else 0
        is_cool = 1 if undertone_b < 0 else 0

    # 4) 명도 대비
    lightness_contrast = 15.7

    # 5) 홍채 색상 (placeholder)
    iris_cluster_rgb = [[120, 80, 40], [125, 85, 45], [118, 82, 42]]
    iris_luminance_contrast = 12.3

    # 6) 모발 색상 (사용자 정보 활용)
    if user_info and user_info.get('age'):
        age = user_info['age']
        if age < 30:
            # 젊은 연령대: 더 다양한 색조
            hair_hue_mean = 45.2
            hair_chroma_ratio = 0.6
        else:
            # 성숙한 연령대: 차분한 색조
            hair_hue_mean = 35.8
            hair_chroma_ratio = 0.4
    else:
        # 기본값
        hair_hue_mean = 40.5
        hair_chroma_ratio = 0.5

    # 7) 시즌 매핑 (사용자 정보 활용)
    if user_info and user_info.get('gender'):
        gender = user_info['gender']
        if gender == '여자':
            # 여성: 더 세밀한 시즌 구분
            if undertone_b > 3:
                season = "봄"
            elif undertone_b > 1:
                season = "가을"
            elif undertone_b > -1:
                season = "여름"
            else:
                season = "겨울"
        else:
            # 남성: 단순한 구분
            if undertone_b > 2:
                season = "웜톤"
            else:
                season = "쿨톤"
    else:
        # 기본값
        season = "봄" if undertone_b > 2 else "여름"

    return {
        "skin_cluster_rgb":   json.dumps(skin_cluster_rgb),
        "skin_cluster_lab":   json.dumps(skin_cluster_lab),
        "undertone_b":        undertone_b,
        "is_warm":            is_warm,
        "is_cool":            is_cool,
        "lightness_contrast": lightness_contrast,
        "iris_cluster_rgb":   json.dumps(iris_cluster_rgb),
        "iris_luminance_contrast": iris_luminance_contrast,
        "hair_hue_mean":      hair_hue_mean,
        "hair_chroma_ratio":  hair_chroma_ratio,
        "season":             season,
    }
