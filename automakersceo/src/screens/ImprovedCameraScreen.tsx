import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  Dimensions,
  Animated,
  StatusBar,
  Share,
} from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { Svg, Circle, G, Ellipse } from 'react-native-svg';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system';
import {
  calculateBrightness,
  isOptimalBrightness,
  getBrightnessStatus,
  BrightnessData,
} from '../utils/brightnessDetector';

const { width, height } = Dimensions.get('window');

interface FaceDetectionResult {
  bounds: {
    origin: { x: number; y: number };
    size: { width: number; height: number };
  };
  rollAngle: number;
  yawAngle: number;
}

// 웹 얼굴 인식 및 밝기 분석용 face-api.js 로드
const isWeb = typeof window !== 'undefined' && !!window.navigator;

export default function ImprovedCameraScreen(props: any) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraType, setCameraType] = useState(CameraType.front);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [brightness, setBrightness] = useState(0);
  const [brightnessStatus, setBrightnessStatus] = useState<'optimal' | 'too_dark' | 'too_bright'>('optimal');
  const [autoCaptureTimer, setAutoCaptureTimer] = useState<NodeJS.Timeout | null>(null);
  const [captureCountdown, setCaptureCountdown] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);

  // cameraRef 정의 추가
  const cameraRef = useRef<any>(null);

  // cancelAutoCapture 함수 추가
  const cancelAutoCapture = React.useCallback(() => {
    if (autoCaptureTimer) {
      clearTimeout(autoCaptureTimer);
      setAutoCaptureTimer(null);
    }
    setCaptureCountdown(0);
  }, [autoCaptureTimer]);

  // 1. 상태 추가
  const FACE_DIRECTIONS = ['좌측', '정면', '우측'] as const;
  type FaceDirection = typeof FACE_DIRECTIONS[number];
  const [currentDirectionIdx, setCurrentDirectionIdx] = useState(0); // 0:좌,1:정,2:우
  const [capturedImages, setCapturedImages] = useState<{direction: FaceDirection, uri: string}[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  // 1. 상태 추가 (분석 결과)
  const [analysisResults, setAnalysisResults] = useState<{direction: FaceDirection, metrics: any}[]>([]);

  // 2. 각도별 안내 메시지
  const directionGuide = `지금은 "${FACE_DIRECTIONS[currentDirectionIdx]}"을(를) 바라보고 촬영하세요`;

  // 3. 업로드 함수(임시)
  async function uploadImageToServer(uri: string, direction: FaceDirection) {
    setIsUploading(true);
    try {
      // 실제 서버 주소로 변경 필요
      const formData = new FormData();
      formData.append('file', { uri, name: `face_${direction}.jpg`, type: 'image/jpeg' } as any);
      formData.append('direction', direction);
      const res = await fetch('https://your-server.com/analyze_face_directions', {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (!res.ok) throw new Error('업로드 실패');
      const data = await res.json();
      setAnalysisResults(prev => [...prev, { direction, metrics: data.metrics }]);
      Alert.alert('분석 성공', `${direction} 분석 결과가 도착했습니다.`);
    } catch (e) {
      Alert.alert('업로드/분석 오류', String(e));
    } finally {
      setIsUploading(false);
    }
  }

  // 4. 각도별 촬영 및 업로드 로직
  const takePicture = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    setCaptureCountdown(0);
    cancelAutoCapture();
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9, base64: false });
      await MediaLibrary.saveToLibraryAsync(photo.uri);
      setCapturedImages(prev => [...prev, { direction: FACE_DIRECTIONS[currentDirectionIdx], uri: photo.uri }]);
      await uploadImageToServer(photo.uri, FACE_DIRECTIONS[currentDirectionIdx]);
      // 다음 각도로 이동
      if (currentDirectionIdx < FACE_DIRECTIONS.length - 1) {
        setCurrentDirectionIdx(currentDirectionIdx + 1);
        setShowInstructions(true);
      } else {
        Alert.alert('촬영 완료', '모든 각도 촬영이 끝났습니다.');
      }
    } catch (error) {
      Alert.alert('오류', '사진 촬영 중 오류가 발생했습니다.');
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, cancelAutoCapture, currentDirectionIdx]);

  // 수동 촬영
  const handleManualCapture = useCallback(() => {
    if (!isOptimalBrightness(brightness)) {
      const status = getBrightnessStatus(brightness);
      Alert.alert('조명 상태', status.message);
      return;
    }
    takePicture();
  }, [brightness, takePicture]);

  // 분석 결과에서 현재 각도에 해당하는 결과 추출
  const currentResult = analysisResults.find(r => r.direction === FACE_DIRECTIONS[currentDirectionIdx]);
  const overlayLandmarks = currentResult?.metrics?.geometry?.landmarks_2d || [];
  const overlaySpots = currentResult?.metrics?.texture?.spot_coords || [];
  const overlayPores = currentResult?.metrics?.texture?.pore_coords || [];
  const overlayAcnes = currentResult?.metrics?.texture?.acne_coords || [];

  // 각도별 피드백 메시지 생성 함수
  function getFeedback(metrics: any) {
    if (!metrics) return '';
    const faceShape = metrics.geometry?.face_shape;
    const pore = metrics.texture?.pore_ratio;
    const spot = metrics.texture?.spot_ratio;
    let msg = '';
    if (faceShape) msg += `얼굴형: ${faceShape}\n`;
    if (pore !== undefined) msg += `모공: ${pore < 0.1 ? '적음' : pore < 0.15 ? '보통' : '많음'}  `;
    if (spot !== undefined) msg += `주근깨: ${spot < 0.03 ? '적음' : spot < 0.07 ? '보통' : '많음'}`;
    return msg;
  }

  const resultViewRef = useRef(null);

  // 결과 저장/공유 함수
  async function saveAndShareResult() {
    if (!resultViewRef.current) return;
    try {
      const uri = await captureRef(resultViewRef, { format: 'png', quality: 1 });
      // 저장
      await MediaLibrary.saveToLibraryAsync(uri);
      // 공유
      await Share.share({ url: uri, message: '얼굴 분석 결과를 확인해보세요!' });
      Alert.alert('저장/공유 완료', '분석 결과가 저장 및 공유되었습니다.');
    } catch (e) {
      Alert.alert('저장/공유 오류', String(e));
    }
  }

  // onCameraReady, onFacesDetected 함수 정의 추가
  const onCameraReady = () => {};
  const onFacesDetected = () => {};

  // 카메라 권한 요청 useEffect (웹 진단용)
  useEffect(() => {
    alert('useEffect 실행됨');
    console.log('useEffect 실행됨');
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          console.log('브라우저 카메라 권한 허용됨');
          setHasPermission(true);
        })
        .catch(err => {
          console.error('브라우저 카메라 권한 거부됨', err);
          setHasPermission(false);
        });
    } else {
      console.error('mediaDevices API를 지원하지 않음');
      setHasPermission(false);
    }
  }, []);

  // 밝기 애니메이션 값 선언
  const brightnessAnimation = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(brightnessAnimation, {
      toValue: brightness / 100,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [brightness]);

  // 웹 전용 상태/참조 변수 선언
  const [webFaceDetected, setWebFaceDetected] = useState(false);
  const [webBrightness, setWebBrightness] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  if (isWeb) {
    return (
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',background:'#000'}}>
        <video ref={videoRef} width={320} height={240} style={{border:'2px solid #fff',borderRadius:8}} autoPlay muted playsInline />
        <canvas ref={canvasRef} width={160} height={120} style={{display:'none'}} />
        <div style={{color:'#fff',marginTop:16,fontSize:18}}>
          얼굴 인식: {webFaceDetected ? '✅ 감지됨' : '❌ 미감지'}<br/>
          밝기: {webBrightness}%
        </div>
        <div style={{color:'#fff',marginTop:8,fontSize:14}}>
          (웹 데모: face-api.js 기반 실시간 얼굴/밝기 인식)<br/>
          <a href="https://github.com/justadudewhohacks/face-api.js" style={{color:'#0af'}} target="_blank">face-api.js</a>
        </div>
      </div>
    );
  }

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>권한을 요청 중...</Text>
      </View>
    );
  }
  
  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>카메라 권한이 필요합니다.</Text>
        <Text style={styles.subText}>설정에서 카메라 권한을 허용해주세요.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
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
        {/* 얼굴 인식 오버레이 + 분석 결과 오버레이 */}
        <View style={styles.overlay} pointerEvents="none">
          <Svg width={width} height={height} style={styles.overlaySvg}>
            <G>
              {/* 기존 원/가이드 */}
              <Circle cx={width / 2} cy={height / 2} r={140} stroke="#FFFFFF" strokeWidth={2} fill="none" opacity={0.3} />
              <Circle cx={width / 2} cy={height / 2} r={120} stroke={faceDetected ? '#00FF00' : '#FFFFFF'} strokeWidth={3} fill="none" opacity={0.7} />
              <Circle cx={width / 2} cy={height / 2} r={100} stroke="#FFFFFF" strokeWidth={1} strokeDasharray="5,5" fill="none" opacity={0.5} />
              {/* 얼굴 랜드마크 점 */}
              {overlayLandmarks.map(([x, y], i) => (
                <Circle key={`lm-${i}`} cx={x} cy={y} r={2.5} fill="#00FFCC" opacity={0.8} />
              ))}
              {/* 피부 특징: spot(주근깨/점) */}
              {overlaySpots.map(([x, y], i) => (
                <Circle key={`spot-${i}`} cx={x} cy={y} r={4} fill="#FFD700" opacity={0.7} />
              ))}
              {/* 피부 특징: pore(모공) */}
              {overlayPores.map(([x, y], i) => (
                <Circle key={`pore-${i}`} cx={x} cy={y} r={3} fill="#00FF00" opacity={0.6} />
              ))}
              {/* 피부 특징: acne(여드름) */}
              {overlayAcnes.map(([x, y], i) => (
                <Ellipse key={`acne-${i}`} cx={x} cy={y} rx={5} ry={3} fill="#FF3333" opacity={0.6} />
              ))}
            </G>
          </Svg>
        </View>

        {/* 상태 표시 */}
        <View style={styles.statusContainer}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>얼굴 인식:</Text>
            <Text style={[styles.statusValue, faceDetected && styles.statusSuccess]}>
              {faceDetected ? '✅ 감지됨' : '❌ 미감지'}
            </Text>
          </View>
          
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>밝기:</Text>
            <Text style={[styles.statusValue, brightnessStatus === 'optimal' && styles.statusSuccess]}>
              {brightness.toFixed(1)}%
            </Text>
          </View>

          {/* 밝기 상태 표시 */}
          <View style={styles.brightnessIndicator}>
            <View style={styles.brightnessBar}>
              <Animated.View
                style={[
                  styles.brightnessFill,
                  {
                    width: brightnessAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                    backgroundColor: brightnessStatus === 'optimal' ? '#00FF00' : '#FF0000',
                  },
                ]}
              />
            </View>
            <Text style={styles.brightnessStatus}>
              {getBrightnessStatus(brightness).message}
            </Text>
          </View>
        </View>

        {/* 카운트다운 */}
        {captureCountdown > 0 && (
          <Animated.View style={styles.countdownContainer}>
            <Text style={styles.countdownText}>{captureCountdown}</Text>
          </Animated.View>
        )}

        {/* 사용법 안내 */}
        {showInstructions && (
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>각도별 촬영 안내</Text>
            <Text style={styles.instructionsText}>{directionGuide}</Text>
            <Text style={styles.instructionsText}>({currentDirectionIdx+1} / 3)</Text>
            <Text style={styles.instructionsText}>• 안내에 따라 얼굴 방향을 바꿔주세요.\n• 각도별로 자동/수동 촬영이 진행됩니다.</Text>
          </View>
        )}

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

        {/* 분석 결과 요약 UI (Camera 컴포넌트 하단에 추가) */}
        <View style={{marginTop: 10, alignItems: 'center'}}>
          {analysisResults.map((r, idx) => (
            <View key={r.direction} style={{marginVertical: 4, backgroundColor: '#222', borderRadius: 8, padding: 8, minWidth: 200}}>
              <Text style={{color: '#fff', fontWeight: 'bold'}}>{r.direction} 분석 결과</Text>
              <Text style={{color: '#fff', fontSize: 12}}>
                얼굴형: {r.metrics?.geometry?.face_shape ?? '-'}\n
                피부(모공): {r.metrics?.texture?.pore_ratio ? r.metrics.texture.pore_ratio.toFixed(2) : '-'}
                / 주근깨: {r.metrics?.texture?.spot_ratio ? r.metrics.texture.spot_ratio.toFixed(2) : '-'}
                / 주름: {r.metrics?.texture?.wrinkle_density ? r.metrics.texture.wrinkle_density.toFixed(2) : '-'}\n
                표정: {r.metrics?.context?.expression ?? '-'}
              </Text>
            </View>
          ))}
        </View>

        {/* 각도별 분석 피드백 메시지 */}
        {analysisResults.map((r, idx) => (
          <View key={r.direction+"-fb"} style={{marginVertical:2, alignItems:'center'}}>
            <Text style={{color:'#00FF99', fontSize:13}}>{r.direction} 피드백: {getFeedback(r.metrics)}</Text>
          </View>
        ))}

        {/* 전체 분석 완료 시 요약 메시지 + 저장/공유 버튼 */}
        {analysisResults.length === FACE_DIRECTIONS.length && (
          <View ref={resultViewRef} collapsable={false} style={{margin:16, padding:12, backgroundColor:'#222', borderRadius:10, alignItems:'center'}}>
            <Text style={{color:'#fff', fontWeight:'bold', fontSize:16}}>전체 분석이 완료되었습니다!</Text>
            <Text style={{color:'#fff', fontSize:13, marginTop:6}}>결과를 저장하거나 공유해보세요.</Text>
            <TouchableOpacity onPress={saveAndShareResult} style={{marginTop:12, backgroundColor:'#00FF99', borderRadius:8, paddingHorizontal:18, paddingVertical:8}}>
              <Text style={{color:'#222', fontWeight:'bold', fontSize:15}}>결과 저장/공유</Text>
            </TouchableOpacity>
          </View>
        )}
      </Camera>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
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
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    padding: 15,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  statusValue: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusSuccess: {
    color: '#00FF00',
  },
  brightnessIndicator: {
    marginTop: 10,
  },
  brightnessBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  brightnessFill: {
    height: '100%',
    borderRadius: 3,
  },
  brightnessStatus: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 5,
  },
  countdownContainer: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    transform: [{ translateY: -50 }],
  },
  countdownText: {
    color: '#FF0000',
    fontSize: 72,
    fontWeight: 'bold',
    textShadowColor: 'black',
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 6,
  },
  instructionsContainer: {
    position: 'absolute',
    bottom: 150,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 10,
    padding: 20,
  },
  instructionsTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  instructionsText: {
    color: 'white',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
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
  subText: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    opacity: 0.8,
  },
}); 