# modules/geometry.py

import cv2
import numpy as np
import mediapipe as mp

# ─── 1) dlib shape_predictor import를 안전하게 처리 ───
try:
    import dlib
    _shape_predictor = dlib.shape_predictor("config/dlib_models/shape_predictor_68_face_landmarks.dat")
    def _get_landmarks(img):
        detector = dlib.get_frontal_face_detector()
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = detector(gray)
        if faces:
            landmarks = _shape_predictor(gray, faces[0])
            return np.array([[p.x, p.y] for p in landmarks.parts()])
        return None
except Exception:
    # dlib 또는 모델 파일이 없으면 None 리턴
    def _get_landmarks(img):
        return None

def analyze_geometry(image: np.ndarray, user_info: dict = None) -> dict:
    """
    - face_width, face_height: 실제 이미지에서 계산
    - eye_size, nose_width, lip_thickness: 실제 이미지에서 계산
    - symmetry_score: 실제 이미지에서 계산
    - face_shape: 실제 이미지에서 계산
    """
    # MediaPipe Face Mesh 사용
    mp_face_mesh = mp.solutions.face_mesh.FaceMesh(static_image_mode=True)
    results = mp_face_mesh.process(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    
    if not results.multi_face_landmarks:
        # 얼굴이 감지되지 않으면 기본값 반환
        return _get_default_geometry()
    
    landmarks = results.multi_face_landmarks[0].landmark
    h, w = image.shape[:2]
    
    # 실제 얼굴 크기 계산
    face_width, face_height = _calculate_face_size(landmarks, w, h)
    
    # 실제 눈 크기 계산 (사용자 입력 우선)
    if user_info and 'eye_size' in user_info:
        eye_size = float(user_info['eye_size'])
    else:
        eye_size = _calculate_eye_ear(landmarks, w, h)
    # 눈 크기 라벨 분류 (타이트하게)
    eye_size_label = _classify_eye_size(eye_size)
    
    # 실제 코 너비 계산
    nose_width = _calculate_nose_width(landmarks, w, h)
    
    # 실제 입술 두께 계산
    lip_thickness = _calculate_lip_thickness(landmarks, w, h)
    
    # 대칭성 점수 계산
    symmetry_score = _calculate_symmetry(landmarks, w, h)
    
    # 얼굴형 판정
    face_shape = _determine_face_shape(landmarks, w, h)
    
    # landmarks_2d 추가 (픽셀 단위)
    landmarks_2d = [[l.x * w, l.y * h] for l in landmarks]
    
    return {
        "face_width":      face_width,
        "face_height":     face_height,
        "eye_size":        eye_size,
        "eye_size_label":  eye_size_label,
        "nose_width":      nose_width,
        "lip_thickness":   lip_thickness,
        "symmetry_score":  symmetry_score,
        "face_shape":      face_shape,
        "landmarks_2d":    landmarks_2d,
    }

def _get_default_geometry() -> dict:
    """얼굴이 감지되지 않을 때의 기본값"""
    return {
        "face_width":      0.0,
        "face_height":     0.0,
        "eye_size":        0.0,
        "nose_width":      0.0,
        "lip_thickness":   0.0,
        "symmetry_score":  0.0,
        "face_shape":      "unknown",
    }

def _calculate_face_size(landmarks, w: int, h: int) -> tuple:
    """실제 얼굴 크기 계산"""
    # 얼굴 경계점들 (MediaPipe Face Mesh 기준)
    face_boundary = [
        10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
        397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
        172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
    ]
    
    face_points = np.array([[landmarks[i].x * w, landmarks[i].y * h] for i in face_boundary])
    
    # 얼굴 너비와 높이 계산
    face_width = np.max(face_points[:, 0]) - np.min(face_points[:, 0])
    face_height = np.max(face_points[:, 1]) - np.min(face_points[:, 1])
    
    return float(face_width), float(face_height)

def _calculate_eye_ear(landmarks, w: int, h: int) -> float:
    """
    Eye Aspect Ratio(EAR) 기반 눈 크기 계산
    """
    # 왼쪽 눈
    left = [33, 160, 158, 133, 153, 144]
    # 오른쪽 눈
    right = [362, 385, 387, 263, 373, 380]
    def ear(indices):
        p = [np.array([landmarks[i].x * w, landmarks[i].y * h]) for i in indices]
        A = np.linalg.norm(p[1] - p[5])
        B = np.linalg.norm(p[2] - p[4])
        C = np.linalg.norm(p[0] - p[3])
        return (A + B) / (2.0 * C) if C > 0 else 0.0
    left_ear = ear(left)
    right_ear = ear(right)
    avg_ear = (left_ear + right_ear) / 2
    return float(avg_ear)

def _classify_eye_size(ear: float) -> str:
    """
    EAR(눈 가로/세로 비율) 기준으로 눈 크기 라벨 분류 (타이트하게)
    - 0.25 미만: '작은 눈'
    - 0.25~0.3: '보통'
    - 0.3 이상: '큰 눈'
    """
    if ear < 0.25:
        return "작은 눈"
    elif ear < 0.3:
        return "보통"
    else:
        return "큰 눈"

def _calculate_nose_width(landmarks, w: int, h: int) -> float:
    """실제 코 너비 계산"""
    # 코 영역 좌표
    nose_indices = [129, 358, 343, 277, 279, 360, 279, 331, 294, 460, 461, 462, 463, 464, 465, 466, 467]
    
    nose_points = np.array([[landmarks[i].x * w, landmarks[i].y * h] for i in nose_indices])
    
    # 코 너비 계산
    nose_width = np.max(nose_points[:, 0]) - np.min(nose_points[:, 0])
    
    return float(nose_width)

def _calculate_lip_thickness(landmarks, w: int, h: int) -> float:
    """실제 입술 두께 계산"""
    # 입술 영역 좌표
    lip_indices = [61, 84, 17, 314, 405, 320, 307, 375, 321, 308, 324, 318, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308]
    
    lip_points = np.array([[landmarks[i].x * w, landmarks[i].y * h] for i in lip_indices])
    
    # 입술 두께 계산 (상하 거리)
    lip_thickness = np.max(lip_points[:, 1]) - np.min(lip_points[:, 1])
    
    return float(lip_thickness)

def _calculate_symmetry(landmarks, w: int, h: int) -> float:
    """대칭성 점수 계산"""
    # 얼굴 중심선 기준 좌우 대칭점들
    left_points = [33, 133, 159, 145, 158, 153, 144, 145, 173, 133, 157, 158, 159, 160, 161, 246]  # 왼쪽 눈
    right_points = [362, 263, 386, 374, 387, 373, 388, 466, 388, 387, 386, 385, 384, 398]  # 오른쪽 눈
    
    left_coords = np.array([[landmarks[i].x * w, landmarks[i].y * h] for i in left_points])
    right_coords = np.array([[landmarks[i].x * w, landmarks[i].y * h] for i in right_points])
    
    # 좌우 대칭성 계산
    left_center = np.mean(left_coords, axis=0)
    right_center = np.mean(right_coords, axis=0)
    
    # 중심선에서의 거리 차이
    symmetry_diff = abs(left_center[0] - (w - right_center[0]))
    
    # 대칭성 점수 (0~1, 1이 완벽한 대칭)
    symmetry_score = max(0, 1 - (symmetry_diff / w))
    
    return float(symmetry_score)

def _determine_face_shape(landmarks, w: int, h: int) -> str:
    """얼굴형 판정"""
    # 얼굴 경계점들
    face_boundary = [
        10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
        397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
        172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
    ]
    
    face_points = np.array([[landmarks[i].x * w, landmarks[i].y * h] for i in face_boundary])
    
    # 얼굴 비율 계산
    face_width = np.max(face_points[:, 0]) - np.min(face_points[:, 0])
    face_height = np.max(face_points[:, 1]) - np.min(face_points[:, 1])
    aspect_ratio = face_width / face_height if face_height > 0 else 1.0
    
    # 얼굴형 판정
    if aspect_ratio > 0.85:
        return "round"
    elif aspect_ratio > 0.75:
        return "oval"
    elif aspect_ratio > 0.65:
        return "heart"
    else:
        return "long"
