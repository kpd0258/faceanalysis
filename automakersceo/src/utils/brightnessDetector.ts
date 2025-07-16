export interface BrightnessData {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export const calculateBrightness = (imageData: BrightnessData): number => {
  const { data, width, height } = imageData;
  let totalBrightness = 0;
  let pixelCount = 0;

  // 이미지의 중앙 부분만 분석 (더 정확한 밝기 측정을 위해)
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const sampleSize = Math.min(width, height) / 4; // 중앙 1/4 영역만 샘플링

  const startX = Math.max(0, centerX - sampleSize / 2);
  const endX = Math.min(width, centerX + sampleSize / 2);
  const startY = Math.max(0, centerY - sampleSize / 2);
  const endY = Math.min(height, centerY + sampleSize / 2);

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];

      // RGB를 밝기로 변환 (ITU-R BT.709 표준)
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      totalBrightness += brightness;
      pixelCount++;
    }
  }

  if (pixelCount === 0) return 0;

  // 0-255 범위를 0-100%로 변환
  const averageBrightness = totalBrightness / pixelCount;
  return (averageBrightness / 255) * 100;
};

export const isOptimalBrightness = (brightness: number): boolean => {
  return brightness >= 20 && brightness <= 80;
};

export const getBrightnessStatus = (brightness: number): {
  status: 'optimal' | 'too_dark' | 'too_bright';
  message: string;
} => {
  if (brightness < 20) {
    return {
      status: 'too_dark',
      message: '너무 어둡습니다. 더 밝은 곳에서 촬영해주세요.',
    };
  } else if (brightness > 80) {
    return {
      status: 'too_bright',
      message: '너무 밝습니다. 적절한 조명에서 촬영해주세요.',
    };
  } else {
    return {
      status: 'optimal',
      message: '조명이 적절합니다.',
    };
  }
}; 