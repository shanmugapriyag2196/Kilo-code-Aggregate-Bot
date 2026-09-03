@echo off
setlocal enabledelayedexpansion
git ls-files -s .env.example > "%TEMP%\env.lst"
for /f "tokens=1,2,3,4,*" %%a in ("%TEMP%\env.lst") do (
  set "BLOB=%%c"
  git cat-file blob !BLOB! | python "%~dp0scrub-blob.py" > "%TEMP%\env.new"
  for /f %%h in ('git hash-object -w --stdin ^< "%TEMP%\env.new"') do set "NEWHASH=%%h"
  git update-index --add --cacheinfo 100644,!NEWHASH!,.env.example
)
del "%TEMP%\env.lst" 2>nul
del "%TEMP%\env.new" 2>nul
exit /b 0
