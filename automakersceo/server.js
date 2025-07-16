const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 3000;

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);

    // 기본 경로를 index.html로 설정
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);

    // 파일 확장자 가져오기
    const extname = path.extname(filePath);
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // 파일 읽기
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // 파일을 찾을 수 없음
                res.writeHead(404);
                res.end('404 - 파일을 찾을 수 없습니다');
            } else {
                // 서버 오류
                res.writeHead(500);
                res.end(`500 - 서버 오류: ${error.code}`);
            }
        } else {
            // 성공적으로 파일 전송
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(port, '0.0.0.0', () => {
    console.log(`서버가 http://localhost:${port} 에서 실행 중입니다`);
    console.log(`모바일 접속 주소: http://192.168.0.3:${port}`);
    console.log('브라우저에서 위 주소로 접속하여 카메라 앱을 사용하세요');
    console.log('모바일에서 사용하려면 같은 Wi-Fi 네트워크의 다른 기기에서 접속하세요');
}); 