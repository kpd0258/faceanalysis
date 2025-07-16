const https = require('https');
const fs = require('fs');
const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const app = express();
const PORT = 8443; // GIS 서버용 포트

let options;
try {
  options = {
    key: fs.readFileSync(path.join(__dirname, 'automakersceo', 'cert', 'privkey.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'automakersceo', 'cert', 'fullchain.pem'))
  };
} catch (e) {
  console.error('SSL 인증서 파일을 찾을 수 없습니다. automakersceo/cert/privkey.pem, automakersceo/cert/fullchain.pem 경로를 확인하세요.');
  process.exit(1);
}

// 보안 헤더 추가
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// CORS 설정
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// FastAPI 서버로 프록시
app.use('*', (req, res) => {
  // FastAPI 서버로 요청을 전달
  const fastapiUrl = 'http://localhost:8000' + req.originalUrl;
  
  const proxyReq = require('http').request(fastapiUrl, {
    method: req.method,
    headers: req.headers
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  
  req.pipe(proxyReq);
});

https.createServer(options, app).listen(PORT, () => {
  const localIP = getLocalIP();
  console.log(`GIS HTTPS 서버가 https://localhost:${PORT} 에서 실행 중입니다.`);
  console.log(`내부망(모바일) 접속: https://${localIP}:${PORT}`);
  console.log('FastAPI 서버(포트 8000)가 실행 중인지 확인하세요.');
}); 