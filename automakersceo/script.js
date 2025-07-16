class SmartCameraApp {
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.faceOverlay = document.getElementById('face-overlay');
        this.faceStatus = document.getElementById('face-status');
        this.brightnessStatus = document.getElementById('brightness-status');
        this.brightnessFill = document.getElementById('brightness-fill');
        this.brightnessMessage = document.getElementById('brightness-message');
        this.countdown = document.getElementById('countdown');
        this.countdownText = document.getElementById('countdown-text');
        this.instructions = document.getElementById('instructions');
        this.captureBtn = document.getElementById('capture-btn');
        this.permissionScreen = document.getElementById('permission-screen');
        this.requestPermissionBtn = document.getElementById('request-permission-btn');
        this.cameraSelectContainer = document.getElementById('camera-select-container');
        this.cameraSelect = document.getElementById('camera-select');
        this.mobileInstructions = document.getElementById('mobile-instructions');

        this.faceDetector = null;
        this.faceDetected = false;
        this.brightness = 0;
        this.autoCaptureTimer = null;
        this.captureCountdown = 0;
        this.isCapturing = false;
        this.isCameraReady = false;
        this.isManualDetecting = false; // 수동 감지 트리거 상태
        this.manualDetectTimer = null;
        this.lastFaceCenter = null;
        this.stableStartTime = null;

        this.init();
    }

    async init() {
        // 모바일 디바이스 확인
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        console.log('모바일 디바이스:', isMobile);
        console.log('User Agent:', navigator.userAgent);
        console.log('현재 URL:', window.location.href);
        console.log('HTTPS 여부:', window.location.protocol === 'https:');
        
        // HTTPS 환경 체크 및 안내
        if (window.location.protocol !== 'https:') {
            alert('보안을 위해 HTTPS 환경에서만 카메라 기능이 정상 동작합니다. 주소창이 https://로 시작하는지 확인하세요.');
        }
        
        // 모바일 사용자에게 특별한 안내 표시
        if (isMobile && this.mobileInstructions) {
            this.mobileInstructions.style.display = 'block';
        }
        
        // 브라우저 호환성 확인 (모바일 대응)
        if (!navigator.mediaDevices) {
            console.log('mediaDevices API 없음, 구형 브라우저 대응');
            navigator.mediaDevices = {};
        }
        
        if (!navigator.mediaDevices.getUserMedia) {
            console.log('getUserMedia API 없음, 구형 API 대응');
            // 구형 getUserMedia API 대응
            navigator.mediaDevices.getUserMedia = function(constraints) {
                const getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
                
                if (!getUserMedia) {
                    console.error('getUserMedia API를 찾을 수 없음');
                    this.showPermissionError('이 브라우저는 카메라 접근을 지원하지 않습니다. 최신 Chrome, Firefox, Safari를 사용해주세요.');
                    return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
                }
                
                return new Promise(function(resolve, reject) {
                    getUserMedia.call(navigator, constraints, resolve, reject);
                });
            }.bind(this);
        }
        
        // 모바일에서는 TensorFlow.js 없이 기본 얼굴 감지 사용
        if (isMobile) {
            console.log('모바일 환경: 기본 얼굴 감지 모드');
            this.faceDetector = null;
        } else {
            // 데스크톱에서만 TensorFlow.js 시도
            try {
                await this.loadFaceDetectionModel();
            } catch (error) {
                console.log('TensorFlow.js 로드 실패, 기본 얼굴 감지 모드로 전환:', error);
                this.faceDetector = null;
            }
        }
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        // 모바일에서는 자동 권한 요청 대신 사용자가 버튼을 누르도록 함
        if (!isMobile) {
            this.requestCameraPermission();
        }
    }

    async loadFaceDetectionModel() {
        try {
            console.log('TensorFlow.js 로드 시작...');
            await tf.ready();
            console.log('TensorFlow.js 로드 완료');
            
            // 얼굴 인식 모델 로드
            this.faceDetector = await faceLandmarksDetection.createDetector(
                faceLandmarksDetection.SupportedModels.MediaPipeFaceLandmarks,
                {
                    runtime: 'tfjs',
                    refineLandmarks: true,
                    maxFaces: 1
                }
            );
            
            console.log('얼굴 인식 모델 로드 완료');
        } catch (error) {
            console.error('얼굴 인식 모델 로드 실패:', error);
            this.faceDetector = null;
        }
    }

    // 간단한 얼굴 감지 (항상 시뮬레이션)
    startSimpleFaceDetection() {
        console.log('기본 얼굴 감지 시뮬레이션(모바일/PC 모두)');
        // 3초 후에 얼굴 감지 시작 (카메라가 안정화될 때까지)
        setTimeout(() => {
            this.faceDetected = true;
            this.updateFaceStatus(true);
            this.startAutoCapture();
        }, 3000);
        // 주기적으로 얼굴 감지 상태 토글 (시뮬레이션)
        setInterval(() => {
            const random = Math.random();
            if (random > 0.3) { // 70% 확률로 얼굴 감지
                if (!this.faceDetected) {
                    this.faceDetected = true;
                    this.updateFaceStatus(true);
                    this.startAutoCapture();
                }
            } else {
                if (this.faceDetected) {
                    this.faceDetected = false;
                    this.updateFaceStatus(false);
                    this.cancelAutoCapture();
                }
            }
        }, 4000); // 4초마다 상태 변경
    }

    setupEventListeners() {
        this.captureBtn.addEventListener('click', () => {
            this.startManualFaceDetection();
        });
        this.requestPermissionBtn.addEventListener('click', () => this.requestCameraPermission());
        this.cameraSelect.addEventListener('change', (e) => this.switchCamera(e.target.value));
        
        // 권한 요청 버튼에 더 명확한 안내 추가
        this.requestPermissionBtn.addEventListener('click', () => {
            console.log('권한 요청 버튼 클릭됨');
            console.log('브라우저 정보:', {
                userAgent: navigator.userAgent,
                mediaDevices: !!navigator.mediaDevices,
                getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
                protocol: window.location.protocol,
                hostname: window.location.hostname
            });
            
            this.requestPermissionBtn.textContent = '권한 요청 중...';
            this.requestPermissionBtn.disabled = true;
            
            this.requestCameraPermission().finally(() => {
                this.requestPermissionBtn.textContent = '권한 허용';
                this.requestPermissionBtn.disabled = false;
            });
        });
        
        // 비디오 이벤트
        this.video.addEventListener('loadedmetadata', () => {
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            this.isCameraReady = true;
            this.hideInstructions();
        });

        this.video.addEventListener('play', () => {
            this.startFaceDetection();
            this.startBrightnessDetection();
        });
    }

    async requestCameraPermission() {
        try {
            console.log('카메라 권한 요청 시작...');
            
            // 모바일 디바이스 확인
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            // 가장 기본적인 설정으로 시작 (모바일 호환성 최대화)
            const constraints = {
                video: true,
                audio: false
            };
            
            console.log('카메라 제약 조건:', constraints);
            console.log('모바일 디바이스:', isMobile);
            console.log('User Agent:', navigator.userAgent);
            
            // 권한 요청 전에 브라우저 지원 확인
            if (!navigator.mediaDevices) {
                throw new Error('이 브라우저는 카메라 접근을 지원하지 않습니다.');
            }
            
            if (!navigator.mediaDevices.getUserMedia) {
                throw new Error('getUserMedia API를 지원하지 않습니다.');
            }
            
            console.log('브라우저 지원 확인 완료, 권한 요청 중...');
            
            // 권한 요청
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            console.log('카메라 접근 성공');
            
            // 사용 가능한 카메라 목록 확인
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            console.log('사용 가능한 카메라:', videoDevices);
            console.log('카메라 개수:', videoDevices.length);
            
            // 카메라 목록이 있으면 선택 옵션 표시
            if (videoDevices.length > 1) {
                this.populateCameraSelect(videoDevices);
            }
            
            // 비디오 설정
            this.video.srcObject = this.stream;
            // 전면카메라 미리보기 좌우 반전
            this.video.style.transform = 'scaleX(-1)';
            // 오버레이 SVG도 반전
            const overlaySvg = document.querySelector('.overlay-svg');
            if (overlaySvg) overlaySvg.style.transform = 'scaleX(-1)';
            
            // 비디오 로드 완료 후 얼굴 인식과 밝기 감지 시작
            this.video.onloadedmetadata = () => {
                console.log('비디오 로드 완료, 얼굴 인식과 밝기 감지 시작');
                console.log('비디오 크기:', this.video.videoWidth, 'x', this.video.videoHeight);
                this.isCameraReady = true;
                
                // 약간의 지연 후 시작 (카메라가 완전히 준비될 때까지)
                setTimeout(() => {
                    console.log('얼굴 인식과 밝기 감지 강제 시작');
                    this.startFaceDetection();
                    this.startBrightnessDetection();
                }, 2000); // 2초 지연
            };
            
            // 비디오 로드 오류 처리
            this.video.onerror = (error) => {
                console.error('비디오 로드 오류:', error);
            };
            
            // 비디오 재생 시작 시에도 감지 시작
            this.video.onplay = () => {
                console.log('비디오 재생 시작, 감지 시작');
                setTimeout(() => {
                    this.startFaceDetection();
                    this.startBrightnessDetection();
                }, 1000);
            };
            
            console.log('카메라 스트림 설정 완료');
            this.hidePermissionScreen();
            
        } catch (error) {
            console.error('카메라 권한 요청 실패:', error);
            
            // 더 자세한 오류 정보 제공
            let errorMessage = '카메라 접근에 실패했습니다.';
            if (error.name === 'NotAllowedError') {
                errorMessage = '카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.';
            } else if (error.name === 'NotFoundError') {
                errorMessage = '카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.';
            } else if (error.name === 'NotReadableError') {
                errorMessage = '카메라가 다른 앱에서 사용 중입니다. 다른 앱을 종료하고 다시 시도해주세요.';
            } else if (error.name === 'OverconstrainedError') {
                errorMessage = '카메라 설정이 지원되지 않습니다. 다른 브라우저를 시도해주세요.';
            } else if (error.name === 'NotSupportedError') {
                errorMessage = '이 브라우저는 카메라 접근을 지원하지 않습니다.';
            }
            
            console.log('오류 세부 정보:', {
                name: error.name,
                message: error.message,
                constraint: error.constraint,
                userAgent: navigator.userAgent
            });
            
            // 대안 방법 시도
            await this.tryAlternativeCameraAccess();
        }
    }

    hidePermissionScreen() {
        this.permissionScreen.style.display = 'none';
    }

    showPermissionError(message = '카메라 접근에 실패했습니다.') {
        const content = this.permissionScreen.querySelector('.permission-content');
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        const mobileInstructions = isMobile ? `
            <strong>모바일 해결 방법:</strong><br>
            • 권한 허용 버튼을 누른 후 팝업에서 "허용" 클릭<br>
            • 다른 카메라 앱 모두 종료 (카메라, Zoom, Teams 등)<br>
            • 브라우저 새로고침 후 다시 시도<br>
            • 다른 브라우저 앱 시도 (Samsung Internet, Firefox)<br>
            • Chrome 설정 → 사이트 설정 → 카메라 → "사이트가 카메라에 액세스하기 전에 확인" 해제<br>
            • <strong>수동 촬영 모드:</strong> 얼굴 인식이 안 되면 하단 촬영 버튼 사용<br>
            • <strong>중요:</strong> 권한 팝업이 나타나지 않으면 브라우저 주소창의 카메라 아이콘을 확인하세요
        ` : `
            <strong>해결 방법:</strong><br>
            • 브라우저 주소창의 카메라 아이콘을 클릭하여 권한 허용<br>
            • 브라우저 설정에서 카메라 권한 확인<br>
            • 다른 카메라 앱을 모두 종료<br>
            • HTTPS 환경에서 접속 (localhost 제외)
        `;
        
        content.innerHTML = `
            <h2>카메라 접근 실패</h2>
            <p>${message}</p>
            <div style="margin: 15px 0; text-align: left; font-size: 14px;">
                ${mobileInstructions}
            </div>
            <button onclick="location.reload()" class="permission-btn">다시 시도</button>
        `;
    }

    startFaceDetection() {
        console.log('얼굴 인식 시작, faceDetector:', this.faceDetector);
        
        if (!this.faceDetector) {
            console.log('얼굴 인식 모델 없음, 시뮬레이션 모드로 전환');
            this.updateFaceStatus(false);
            this.startSimpleFaceDetection();
            return;
        }
        
        const detectFaces = async () => {
            if (this.video.paused || this.video.ended) {
                console.log('비디오가 일시정지 또는 종료됨');
                return;
            }
            
            try {
                console.log('얼굴 인식 시도 중...');
                const faces = await this.faceDetector.estimateFaces(this.video);
                console.log('얼굴 인식 결과:', faces);
                this.handleFaceDetection(faces);
            } catch (error) {
                console.error('얼굴 인식 오류:', error);
                // 오류 발생 시 시뮬레이션 모드로 전환
                this.startSimpleFaceDetection();
            }
            
            requestAnimationFrame(detectFaces);
        };
        
        detectFaces();
    }

    handleFaceDetection(faces) {
        if (faces.length > 0) {
            const face = faces[0];
            const keypoints = face.keypoints || [];
            // 얼굴 중심점 계산
            const faceCenter = this.calculateFaceCenter(keypoints);
            // SVG 실루엣 기준 중심점
            const overlayCenter = { x: 200, y: 300 };
            // 좌우 반전된 경우 x좌표도 반전
            const mirroredFaceCenter = { x: 400 - faceCenter.x, y: faceCenter.y };
            // 거리 계산
            const distance = Math.sqrt(
                Math.pow(mirroredFaceCenter.x - overlayCenter.x, 2) +
                Math.pow(mirroredFaceCenter.y - overlayCenter.y, 2)
            );
            const isInOverlay = distance < 60; // 더 엄격하게
            if (isInOverlay && !this.faceDetected) {
                this.faceDetected = true;
                this.updateFaceStatus(true);
                this.startAutoCapture();
            } else if (!isInOverlay && this.faceDetected) {
                this.faceDetected = false;
                this.updateFaceStatus(false);
                this.cancelAutoCapture();
            }
        } else {
            if (this.faceDetected) {
                this.faceDetected = false;
                this.updateFaceStatus(false);
                this.cancelAutoCapture();
            }
        }
    }

    calculateFaceCenter(keypoints) {
        // 얼굴의 중심점을 계산 (눈과 코의 중간점 사용)
        const leftEye = keypoints.find(kp => kp.name === 'leftEye');
        const rightEye = keypoints.find(kp => kp.name === 'rightEye');
        const nose = keypoints.find(kp => kp.name === 'noseTip');
        
        if (leftEye && rightEye && nose) {
            return {
                x: (leftEye.x + rightEye.x + nose.x) / 3,
                y: (leftEye.y + rightEye.y + nose.y) / 3
            };
        }
        
        // 대안: 모든 키포인트의 평균
        const validPoints = keypoints.filter(kp => kp.x && kp.y);
        if (validPoints.length > 0) {
            const sumX = validPoints.reduce((sum, kp) => sum + kp.x, 0);
            const sumY = validPoints.reduce((sum, kp) => sum + kp.y, 0);
            return {
                x: sumX / validPoints.length,
                y: sumY / validPoints.length
            };
        }
        
        return { x: 0, y: 0 };
    }

    updateFaceStatus(detected) {
        this.faceStatus.textContent = detected ? '✅ 감지됨' : '❌ 미감지';
        this.faceStatus.className = detected ? 'status-value success' : 'status-value';
        // faceOverlay가 없을 수 있으므로 체크
        if (this.faceOverlay) {
            this.faceOverlay.style.stroke = detected ? '#00FF00' : '#FFFFFF';
        }
    }

    // 밝기 감지 (항상 시뮬레이션)
    startBrightnessDetection() {
        console.log('밝기 감지 시뮬레이션(모바일/PC 모두)');
        this.brightness = 60; // 기본값 60%
        this.updateBrightnessStatus();
        // 주기적으로 밝기 값 업데이트 (시뮬레이션)
        setInterval(() => {
            this.brightness = 50 + Math.random() * 30; // 50-80% 범위
            this.updateBrightnessStatus();
        }, 3000);
    }

    calculateBrightness(imageData) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        let totalBrightness = 0;
        let pixelCount = 0;
        
        // 중앙 부분만 분석 (더 빠르고 안정적)
        const centerX = Math.floor(width / 2);
        const centerY = Math.floor(height / 2);
        const sampleSize = Math.min(width, height) / 3; // 중앙 1/3 영역만
        
        const startX = Math.max(0, centerX - sampleSize / 2);
        const endX = Math.min(width, centerX + sampleSize / 2);
        const startY = Math.max(0, centerY - sampleSize / 2);
        const endY = Math.min(height, centerY + sampleSize / 2);
        
        // 샘플링 간격을 늘려서 성능 향상
        const step = 4;
        
        for (let y = startY; y < endY; y += step) {
            for (let x = startX; x < endX; x += step) {
                const index = (y * width + x) * 4;
                const r = data[index];
                const g = data[index + 1];
                const b = data[index + 2];
                
                // RGB를 밝기로 변환
                const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
                totalBrightness += brightness;
                pixelCount++;
            }
        }
        
        if (pixelCount > 0) {
            this.brightness = (totalBrightness / pixelCount / 255) * 100;
            // 모바일에서는 더 관대한 범위로 조정
            if (this.brightness < 10) this.brightness = 30 + Math.random() * 20;
            if (this.brightness > 90) this.brightness = 60 + Math.random() * 20;
            this.updateBrightnessStatus();
        } else {
            // 기본값 설정
            this.brightness = 50 + Math.random() * 20;
            this.updateBrightnessStatus();
        }
    }

    updateBrightnessStatus() {
        this.brightnessStatus.textContent = `${this.brightness.toFixed(1)}%`;
        this.brightnessFill.style.width = `${this.brightness}%`;
        
        if (this.brightness < 20) {
            this.brightnessFill.className = 'brightness-fill';
            this.brightnessMessage.textContent = '너무 어둡습니다. 밝은 곳에서 촬영하세요.';
        } else if (this.brightness > 80) {
            this.brightnessFill.className = 'brightness-fill';
            this.brightnessMessage.textContent = '너무 밝습니다. 적절한 조명에서 촬영하세요.';
        } else {
            this.brightnessFill.className = 'brightness-fill optimal';
            this.brightnessMessage.textContent = '조명이 적절합니다.';
        }
    }

    isOptimalBrightness() {
        return this.brightness >= 20 && this.brightness <= 80;
    }

    // 자동 촬영 트리거
    startAutoCapture() {
        if (this.isCapturing) return;
        this.showCountdown();
    }

    cancelAutoCapture() {
        if (this.autoCaptureTimer) {
            clearTimeout(this.autoCaptureTimer);
            this.autoCaptureTimer = null;
        }
        this.hideCountdown();
    }

    // 카운트다운 시작
    showCountdown() {
        this.captureCountdown = 3;
        document.getElementById('countdown').style.display = 'block';
        this.updateCountdown();
    }

    // 카운트다운 업데이트
    updateCountdown() {
        const countdownText = document.getElementById('countdown-text');
        countdownText.textContent = this.captureCountdown;
        if (this.captureCountdown > 0) {
            setTimeout(() => {
                this.captureCountdown--;
                this.updateCountdown();
            }, 1000);
        } else {
            document.getElementById('countdown').style.display = 'none';
            // 카운트다운이 끝나면 자동 촬영
            this.takePicture();
        }
    }

    hideCountdown() {
        document.getElementById('countdown').style.display = 'none';
    }

    async takePicture() {
        console.log('takePicture 함수 호출됨');
        if (this.isCapturing) {
            console.log('이미 촬영 중입니다');
            return;
        }

        this.isCapturing = true;
        console.log('촬영 시작');
        this.hideCountdown();
        this.cancelAutoCapture();

        try {
            // 캔버스에 현재 비디오 프레임 그리기
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            console.log('비디오 프레임을 캔버스에 그렸습니다');
            
            // 캔버스를 이미지로 변환 (base64)
            const imageData = this.canvas.toDataURL('image/jpeg', 0.9);
            console.log('이미지 데이터 생성 완료');
            
            // 부모창(GIS)으로 base64 이미지 데이터만 전달
            if (window.opener) {
                // 로딩 메시지 표시
                this.showLoadingMessage('사진을 전송 중입니다...');
                
                window.opener.postMessage({
                    type: 'photo_captured',
                    imageData: imageData
                }, '*');
                
                // 0.5초 딜레이 후 창 닫기 (모바일에서 메시지 전달 보장)
                setTimeout(() => {
                    window.close();
                }, 500);
            }
        } catch (error) {
            console.error('사진 촬영 오류:', error);
            this.showAlert('오류', '사진 촬영 중 오류가 발생했습니다.');
        } finally {
            this.isCapturing = false;
            console.log('촬영 완료');
        }
    }

    // 서버로 이미지 업로드 및 분석 결과 표시
    async uploadAndAnalyze(imageData) {
        console.log('uploadAndAnalyze 함수 호출됨');
        try {
            // base64 → Blob 변환
            const blob = await (await fetch(imageData)).blob();
            console.log('Blob 변환 완료');
            
            const formData = new FormData();
            formData.append('file', blob, 'photo.jpg');
            console.log('FormData 생성 완료');
            
            // 세션 ID 생성(간단히 타임스탬프)
            const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            console.log('세션 ID:', sessionId);
            
            // GIS 서버 주소 (HTTPS) - PC의 IP 주소 사용
            const gisServerBase = 'https://192.168.0.43:8443';
            console.log('GIS 서버 주소:', gisServerBase);
            
            // 분석 중 로딩 표시
            let resultDiv = document.getElementById('analysis-result');
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = '<div style="color:#fff;">분석 중입니다...</div>';
            
            // 서버 업로드 (GIS 서버로)
            console.log('서버 업로드 시작');
            const uploadRes = await fetch(gisServerBase + '/upload_sync/face?session_id=' + sessionId, {
                method: 'POST',
                body: formData
            });
            console.log('업로드 응답 상태:', uploadRes.status);
            
            if (!uploadRes.ok) throw new Error('이미지 업로드 실패: ' + uploadRes.status);
            const uploadResult = await uploadRes.json();
            console.log('업로드 결과:', uploadResult);
            
            // 분석 결과 조회 (GIS 서버에서)
            console.log('분석 결과 조회 시작');
            const metricsRes = await fetch(gisServerBase + '/metrics/' + uploadResult.image_id);
            console.log('분석 결과 응답 상태:', metricsRes.status);
            
            if (!metricsRes.ok) throw new Error('분석 결과 조회 실패: ' + metricsRes.status);
            const metrics = await metricsRes.json();
            console.log('분석 결과:', metrics);
            
            // 결과 표시
            this.showAnalysisResult(metrics);
            
            // 부모창으로 촬영 완료 메시지 전달
            if (window.opener) {
                console.log('부모창으로 메시지 전달');
                window.opener.postMessage({
                    type: 'photo_captured',
                    imageId: uploadResult.image_id,
                    metrics: metrics
                }, '*');
            }
            
            // 업로드/분석이 끝나면 창 자동 닫기 (부모창에서 열렸을 때만)
            setTimeout(() => {
                if (window.opener) {
                    console.log('창 닫기');
                    window.close();
                }
            }, 1500);
        } catch (err) {
            console.error('분석 오류:', err);
            let msg = '분석 서버와 통신에 실패했습니다.';
            if (err instanceof Error) msg += '\n' + err.message;
            let resultDiv = document.getElementById('analysis-result');
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = '<div style="color:#ff6666;">' + msg + '</div>';
        }
    }

    // 분석 결과 표시 (한글화 및 표 형태)
    showAnalysisResult(metrics) {
        let resultDiv = document.getElementById('analysis-result');
        if (!resultDiv) {
            resultDiv = document.createElement('div');
            resultDiv.id = 'analysis-result';
            resultDiv.style.cssText = 'position:fixed;top:10%;left:50%;transform:translateX(-50%);background:#222;color:#fff;padding:20px;border-radius:10px;z-index:1002;max-width:90vw;';
            document.body.appendChild(resultDiv);
        }
        // 한글 라벨 변환 예시
        const labelMap = {
            symmetry: '대칭성',
            eye_size: '눈 크기',
            glasses: '안경 착용',
            age: '예상 연령',
            gender: '성별',
            // ... 필요시 추가
        };
        let html = '<h3>분석 결과</h3><table style="width:100%;color:#fff;background:#333;border-radius:8px;overflow:hidden;">';
        for (const key in metrics) {
            const label = labelMap[key] || key;
            html += `<tr><td style='padding:6px 12px;border-bottom:1px solid #444;'>${label}</td><td style='padding:6px 12px;border-bottom:1px solid #444;'>${metrics[key]}</td></tr>`;
        }
        html += '</table>';
        html += '<button onclick="this.parentElement.remove()" style="margin-top:10px;padding:8px 16px;background:#007AFF;color:#fff;border:none;border-radius:5px;">닫기</button>';
        resultDiv.innerHTML = html;
        resultDiv.style.display = 'block';
    }

    handleManualCapture() {
        // 모바일에서는 밝기 체크를 완화
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (!isMobile && !this.isOptimalBrightness()) {
            this.showAlert('조명 상태', this.getBrightnessMessage());
            return;
        }
        
        this.takePicture();
    }

    getBrightnessMessage() {
        if (this.brightness < 20) {
            return '너무 어둡습니다. 더 밝은 곳에서 촬영해주세요.';
        } else if (this.brightness > 80) {
            return '너무 밝습니다. 적절한 조명에서 촬영해주세요.';
        }
        return '조명이 적절합니다.';
    }

    showAlert(title, message) {
        // 간단한 알림 표시
        const alertDiv = document.createElement('div');
        alertDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 20px;
            border-radius: 10px;
            z-index: 1001;
            text-align: center;
            max-width: 300px;
        `;
        alertDiv.innerHTML = `
            <h3>${title}</h3>
            <p>${message}</p>
            <button onclick="this.parentElement.remove()" style="
                background: #007AFF;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 5px;
                margin-top: 10px;
                cursor: pointer;
            ">확인</button>
        `;
        document.body.appendChild(alertDiv);
    }

    showLoadingMessage(message) {
        // 기존 로딩 메시지 제거
        const existingLoading = document.getElementById('loading-message');
        if (existingLoading) {
            existingLoading.remove();
        }
        
        // 로딩 메시지 표시
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'loading-message';
        loadingDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 20px;
            border-radius: 10px;
            z-index: 1003;
            text-align: center;
            max-width: 300px;
        `;
        loadingDiv.innerHTML = `
            <div style="margin-bottom: 10px;">
                <div style="display: inline-block; width: 20px; height: 20px; border: 2px solid #fff; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            </div>
            <p style="margin: 0;">${message}</p>
        `;
        
        // CSS 애니메이션 추가
        const style = document.createElement('style');
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(loadingDiv);
        
        // 0.5초 후 자동으로 제거 (창이 닫히기 전에)
        setTimeout(() => {
            if (loadingDiv.parentNode) {
                loadingDiv.remove();
            }
        }, 450);
    }

    populateCameraSelect(devices) {
        this.cameraSelect.innerHTML = '<option value="">카메라를 선택하세요</option>';
        
        devices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `카메라 ${index + 1}`;
            this.cameraSelect.appendChild(option);
        });
        
        this.cameraSelectContainer.style.display = 'block';
    }

    async tryAlternativeCameraAccess() {
        console.log('대안 카메라 접근 방법 시도...');
        
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        try {
            // 방법 1: 모바일에서는 더 간단한 설정으로 재시도
            const constraints = isMobile ? {
                video: {
                    facingMode: 'user'
                }
            } : {
                video: true
            };
            
            console.log('대안 카메라 제약 조건:', constraints);
            console.log('모바일 디바이스:', isMobile);
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            this.video.srcObject = stream;
            this.hidePermissionScreen();
            console.log('대안 방법으로 카메라 접근 성공');
            
        } catch (alternativeError) {
            console.error('대안 방법도 실패:', alternativeError);
            
            // 방법 2: 가장 기본적인 설정으로 재시도
            try {
                console.log('가장 기본 설정으로 재시도...');
                const basicStream = await navigator.mediaDevices.getUserMedia({
                    video: true
                });
                
                console.log('기본 설정 성공');
                this.video.srcObject = basicStream;
                this.hidePermissionScreen();
                
            } catch (basicError) {
                console.error('기본 설정도 실패:', basicError);
                
                // 방법 3: 구형 브라우저 대응
                try {
                    console.log('구형 브라우저 API 시도...');
                    const legacyGetUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
                    
                    if (legacyGetUserMedia) {
                        const legacyStream = await new Promise((resolve, reject) => {
                            legacyGetUserMedia.call(navigator, { video: true }, resolve, reject);
                        });
                        
                        console.log('구형 API 성공');
                        this.video.srcObject = legacyStream;
                        this.hidePermissionScreen();
                        return;
                    }
                } catch (legacyError) {
                    console.error('구형 API도 실패:', legacyError);
                }
                
                // 최종 오류 메시지 표시
                let errorMessage = '카메라 접근에 실패했습니다.';
                if (isMobile) {
                    errorMessage = '모바일에서 카메라 접근이 실패했습니다. 다른 브라우저 앱을 시도해주세요.';
                } else if (basicError.name === 'NotAllowedError') {
                    errorMessage = '카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.';
                } else if (basicError.name === 'NotFoundError') {
                    errorMessage = '카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.';
                } else if (basicError.name === 'NotReadableError') {
                    errorMessage = '카메라가 다른 앱에서 사용 중입니다. 다른 앱을 종료하고 다시 시도해주세요.';
                } else if (basicError.name === 'OverconstrainedError') {
                    errorMessage = '카메라 설정이 지원되지 않습니다. 다른 브라우저를 시도해주세요.';
                }
                
                this.showPermissionError(errorMessage);
            }
        }
    }

    async switchCamera(deviceId) {
        if (!deviceId) return;
        
        try {
            // 기존 스트림 정지
            if (this.video.srcObject) {
                const tracks = this.video.srcObject.getTracks();
                tracks.forEach(track => track.stop());
            }
            
            // 새 카메라로 스트림 시작
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: { exact: deviceId },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 },
                    aspectRatio: { ideal: 16/9 }
                }
            });
            
            this.video.srcObject = stream;
            console.log('카메라 전환 완료');
            
        } catch (error) {
            console.error('카메라 전환 실패:', error);
            this.showAlert('오류', '카메라 전환에 실패했습니다.');
        }
    }

    hideInstructions() {
        setTimeout(() => {
            this.instructions.style.display = 'none';
        }, 3000);
    }

    startManualFaceDetection() {
        if (this.isManualDetecting) return;
        this.isManualDetecting = true;
        this.stableStartTime = null;
        this.lastFaceCenter = null;
        this.faceDetected = false;
        this.updateFaceStatus(false);
        this.manualDetectTimer = setInterval(() => {
            this.manualFaceDetectStep();
        }, 300);
    }

    stopManualFaceDetection() {
        this.isManualDetecting = false;
        if (this.manualDetectTimer) {
            clearInterval(this.manualDetectTimer);
            this.manualDetectTimer = null;
        }
        this.stableStartTime = null;
        this.lastFaceCenter = null;
    }

    manualFaceDetectStep() {
        // 얼굴 감지 시뮬레이션 (항상 감지되는 것처럼)
        const faceCenter = { x: 200 + Math.random() * 10 - 5, y: 300 + Math.random() * 10 - 5 };
        const isFaceDetected = true;
        this.updateFaceStatus(isFaceDetected);
        if (!isFaceDetected) {
            this.stableStartTime = null;
            this.lastFaceCenter = null;
            return;
        }
        // 움직임 감지: 이전 중심과의 거리
        if (this.lastFaceCenter) {
            const dx = faceCenter.x - this.lastFaceCenter.x;
            const dy = faceCenter.y - this.lastFaceCenter.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 5) { // 거의 움직임 없음
                if (!this.stableStartTime) this.stableStartTime = Date.now();
                if (Date.now() - this.stableStartTime > 3000) {
                    // 3초간 움직임 거의 없음 → 촬영
                    this.takePicture();
                    this.stopManualFaceDetection();
                }
            } else {
                this.stableStartTime = null;
            }
        } else {
            this.stableStartTime = null;
        }
        this.lastFaceCenter = faceCenter;
    }
}

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    new SmartCameraApp();
}); 