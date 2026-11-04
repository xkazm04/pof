@echo off
cd /d C:\Users\kazda\kiro\pof
"C:\Program Files\Git\usr\bin\bash.exe" -lc "bash games/gtai/night/supervisor.sh --root C:/Users/kazda/kiro/gtai-n4 --until 11:00 --freeze 10:30 --report-at 10:40 --billing api-first >> C:/Users/kazda/kiro/gtai-n4/logs/run.log 2>&1"
