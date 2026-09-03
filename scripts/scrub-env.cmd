@echo off
setlocal
set F=.env.example
powershell -NoProfile -Command "$f='%F%'; if (Test-Path $f) { (Get-Content $f -Raw) -replace 'pat[A-Za-z0-9_]+\.[A-Za-z0-9_]+','pat_REPLACE_WITH_YOUR_TOKEN' | Set-Content $f -NoNewline }"
exit /b 0
