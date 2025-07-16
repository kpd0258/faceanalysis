@echo off
REM ----------------------------------------
REM export_data.bat
REM • 현재 배치 파일 위치로 이동
cd /d "%~dp0"
REM • 가상환경 활성화 (경로는 필요에 맞게 조정)
call venv\Scripts\Activate.bat
REM • 데이터 내보내기 스크립트 실행
python export_data.py
REM • 완료 메시지 출력 후 일시정지 (원치 않으면 다음 줄을 지우세요)
echo.
echo ===== Export Complete =====
pause
