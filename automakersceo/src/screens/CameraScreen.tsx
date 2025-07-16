import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  Dimensions,
  Animated,
} from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { Svg, Circle, Rect } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

interface FaceDetectionResult {
  bounds: {
    origin: { x: number; y: number };
    size: { width: number; height: number };
  };
  rollAngle: number;
  yawAngle: number;
}

export default function CameraScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraType, setCameraType] = useState(CameraType.front);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [brightness, setBrightness] = useState(0);
  const [autoCaptureTimer, setAutoCaptureTimer] = useState<NodeJS.Timeout | null>(null);
  const [captureCountdown, setCaptureCountdown] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  
  const cameraRef = useRef<Camera>(null);
  const countdownAnimation = useRef(new Animated.Value(0)).current;

  // 권한 요청
  useEffect(() => {
    (async () => {
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
      setHasPermission(cameraStatus === 'granted' && mediaStatus === 'granted');
    })();
  }, []);

  // 카운트다운 애니메이션
  useEffect(() => {
    if (captureCountdown > 0) {
      Animated.timing(countdownAnimation, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: false,
      }).start();
    } else {
      countdownAnimation.setValue(0);
    }
  }, [captureCountdown]);

  // 얼굴 인식 및 밝기 감지
  const onCameraReady = () => {
    setIsCameraReady(true);
  };

  const onFacesDetected = ({ faces }: { faces: FaceDetectionResult[] }) => {
    if (faces.length > 0) {
      const face = faces[0];
      const faceBounds = face.bounds;
      
      // 얼굴이 화면 중앙에 있는지 확인 (오버레이 영역 내)
      const overlayCenter = { x: width / 2, y: height / 2 };
      const faceCenter = {
        x: faceBounds.origin.x + faceBounds.size.width / 2,
        y: faceBounds.origin.y + faceBounds.size.height / 2,
      };
      
      const distance = Math.sqrt(
        Math.pow(faceCenter.x - overlayCenter.x, 2) +
        Math.pow(faceCenter.y - overlayCenter.y, 2)
      );
      
      const isInOverlay = distance < 100; // 오버레이 반지름 내에 있는지 확인
      
      if (isInOverlay && !faceDetected) {
        setFaceDetected(true);
        startAutoCapture();
      } else if (!isInOverlay && faceDetected) {
        setFaceDetected(false);
        cancelAutoCapture();
      }
    } else {
      setFaceDetected(false);
      cancelAutoCapture();
    }
  };

  // 밝기 감지
  const onCameraFrame = (data: any) => {
    // 간단한 밝기 계산 (실제로는 더 정교한 알고리즘 필요)
    const brightness = calculateBrightness(data);
    setBrightness(brightness);
  };

  const calculateBrightness = (frameData: any): number => {
    // 실제 구현에서는 프레임 데이터를 분석하여 밝기 계산
    // 여기서는 임시로 랜덤 값 사용
    return Math.random() * 100;
  };

  // 자동 촬영 시작
  const startAutoCapture = () => {
    if (brightness < 20 || brightness > 80) {
      Alert.alert('조명 상태', '밝기가 적절하지 않습니다. 밝은 곳에서 촬영해주세요.');
      return;
    }

    setCaptureCountdown(3);
    
    const timer = setTimeout(() => {
      takePicture();
    }, 3000);
    
    setAutoCaptureTimer(timer);
  };

  // 자동 촬영 취소
  const cancelAutoCapture = () => {
    if (autoCaptureTimer) {
      clearTimeout(autoCaptureTimer);
      setAutoCaptureTimer(null);
    }
    setCaptureCountdown(0);
  };

  // 사진 촬영
  const takePicture = async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    setCaptureCountdown(0);
    cancelAutoCapture();

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      // 갤러리에 저장
      await MediaLibrary.saveToLibraryAsync(photo.uri);
      
      Alert.alert(
        '촬영 완료',
        '사진이 갤러리에 저장되었습니다.',
        [{ text: '확인' }]
      );
    } catch (error) {
      Alert.alert('오류', '사진 촬영 중 오류가 발생했습니다.');
    } finally {
      setIsCapturing(false);
    }
  };

  // 수동 촬영
  const handleManualCapture = () => {
    if (brightness < 20 || brightness > 80) {
      Alert.alert('조명 상태', '밝기가 적절하지 않습니다. 밝은 곳에서 촬영해주세요.');
      return;
    }
    takePicture();
  };

  if (hasPermission === null) {
    return <View style={styles.container}><Text style={styles.text}>권한을 요청 중...</Text></View>;
  }
  if (hasPermission === false) {
    return <View style={styles.container}><Text style={styles.text}>카메라 권한이 필요합니다.</Text></View>;
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={styles.camera}
        type={cameraType}
        onCameraReady={onCameraReady}
        onFacesDetected={onFacesDetected}
        faceDetectorSettings={{
          mode: 'fast',
          detectLandmarks: 'none',
          runClassifications: 'none',
          minDetectionInterval: 100,
          tracking: true,
        }}
      >
        {/* 얼굴 인식 오버레이 */}
        <View style={styles.overlay}>
          <Svg width={width} height={height} style={styles.overlaySvg}>
            <Circle
              cx={width / 2}
              cy={height / 2}
              r={100}
              stroke={faceDetected ? '#00FF00' : '#FFFFFF'}
              strokeWidth={3}
              fill="none"
              opacity={0.7}
            />
          </Svg>
        </View>

        {/* 상태 표시 */}
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            얼굴 인식: {faceDetected ? '✅' : '❌'}
          </Text>
          <Text style={styles.statusText}>
            밝기: {brightness.toFixed(1)}%
          </Text>
          {captureCountdown > 0 && (
            <Animated.View style={styles.countdownContainer}>
              <Text style={styles.countdownText}>{captureCountdown}</Text>
            </Animated.View>
          )}
        </View>

        {/* 컨트롤 버튼 */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
            onPress={handleManualCapture}
            disabled={isCapturing}
          >
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
        </View>
      </Camera>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlaySvg: {
    position: 'absolute',
  },
  statusContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  statusText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    marginVertical: 2,
  },
  countdownContainer: {
    position: 'absolute',
    top: 100,
    alignItems: 'center',
  },
  countdownText: {
    color: '#FF0000',
    fontSize: 48,
    fontWeight: 'bold',
    textShadowColor: 'black',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  controls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  text: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
}); 