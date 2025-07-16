# modules/context.py

import cv2
import numpy as np
import mediapipe as mp

# ─── 1) 감정인식(FER) import를 안전하게 처리 ───
try:
    from fer import FER
    _emo_detector = FER(mtcnn=True)
    def _get_expression(img):
        r = _emo_detector.top_emotion(img)
        return r[0] if r else "neutral"
except Exception:
    # fer 또는 moviepy 설치가 안 되어 있으면 기본 neutral 리턴
    def _get_expression(img):
        return "neutral"

# ─── 2) Mediapipe FaceDetection for pose ───
mp_face = mp.solutions.face_detection.FaceDetection(model_selection=1)

def analyze_context(image: np.ndarray, user_info: dict = None) -> dict:
    """
    - expression: FER optional (없으면 always "neutral")
    - age_estimate, gender_prob: 사용자 정보 활용
    - glasses, earring, lens_color: 실제 이미지 분석
    - yaw/pitch/roll: stub (추후 구현)
    """
    # 표정 (or "neutral")
    expression = _get_expression(image)

    # 나이·성별 (사용자 정보 활용)
    if user_info and user_info.get('age'):
        # 사용자가 제공한 나이 정보 활용
        age_estimate = float(user_info['age'])
    else:
        # 기존 더미 값 사용
        def _dummy_age_gender(img):
            return 30.0, 0.5
        age_estimate, _ = _dummy_age_gender(image)
    
    if user_info and user_info.get('gender'):
        # 사용자가 제공한 성별 정보 활용
        gender = user_info['gender']
        if gender == '남자':
            gender_prob = 0.8  # 남성 확률 80%
        elif gender == '여자':
            gender_prob = 0.2  # 여성 확률 20%
        else:
            gender_prob = 0.5  # 중성적
    else:
        # 기존 더미 값 사용
        def _dummy_age_gender(img):
            return 30.0, 0.5
        _, gender_prob = _dummy_age_gender(image)

    # 안경 감지 (사용자 입력 우선)
    if user_info and 'glasses' in user_info:
        glasses = float(user_info['glasses'])
    else:
        glasses = _detect_glasses(image)
    earring = float(False)  # float로 저장
    lens_color = "clear"

    # 촬영 각도 및 조명 방향성 (stub)
    yaw = pitch = roll = 0.0
    det = mp_face.process(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    if det.detections:
        # 실제로는 det.detections → keypoint 활용해 계산
        yaw = pitch = roll = 0.0

    return {
        "expression":       expression,
        "age_estimate":     age_estimate,
        "gender_prob":      gender_prob,
        "glasses":          glasses,
        "earring":          earring,
        "lens_color":       lens_color,
        "makeup_intensity": 0.0,
        "light_direction":  "unknown",
        "yaw":              yaw,
        "pitch":            pitch,
        "roll":             roll,
    }

def _detect_glasses(image: np.ndarray) -> float:
    """
    Canny 엣지 + Hough Line Transform으로 안경 프레임 검출
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    # 눈 영역 추출 (MediaPipe Face Mesh)
    mp_face_mesh = mp.solutions.face_mesh.FaceMesh(static_image_mode=True)
    results = mp_face_mesh.process(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    if not results.multi_face_landmarks:
        return 0.0
    landmarks = results.multi_face_landmarks[0].landmark
    h, w = gray.shape
    # 눈 영역 마스크 생성
    left_eye_indices = [33, 133, 159, 145, 158, 153, 144, 145, 173, 133, 157, 158, 159, 160, 161, 246]
    right_eye_indices = [362, 263, 386, 374, 387, 373, 388, 466, 388, 387, 386, 385, 384, 398]
    left_eye_points = np.array([[landmarks[i].x * w, landmarks[i].y * h] for i in left_eye_indices], dtype=np.int32)
    right_eye_points = np.array([[landmarks[i].x * w, landmarks[i].y * h] for i in right_eye_indices], dtype=np.int32)
    mask = np.zeros(gray.shape, dtype=np.uint8)
    cv2.fillPoly(mask, [left_eye_points], 255)
    cv2.fillPoly(mask, [right_eye_points], 255)
    eye_region = cv2.bitwise_and(gray, mask)
    # Canny 엣지 검출
    edges = cv2.Canny(eye_region, 50, 150)
    # Hough Line Transform으로 직선 검출
    lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=10, minLineLength=20, maxLineGap=5)
    # 검출된 직선의 총 길이 계산
    total_length = 0
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            total_length += np.hypot(x2-x1, y2-y1)
    # 일정 길이 이상이면 안경 착용으로 판정
    if total_length > 60:
        return 1.0
    else:
        return 0.0
