@echo off
cd /d C:\Users\kazda\kiro\pof
"C:\Program Files\Git\usr\bin\bash.exe" -lc "bash games/gtai/night/supervisor.sh --root C:/Users/kazda/kiro/gtai-n10 --until 09:00 --freeze 08:30 --report-at 08:40 --billing api-first >> C:/Users/kazda/kiro/gtai-n10/logs/run.log 2>&1"
