# build.ps1  —  Build turbine-analyzer into a distributable folder
# Usage:  .\build.ps1
# Output: dist\turbine-analyzer\turbine-analyzer.exe

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

Write-Host ""
Write-Host "=== Step 1/3: Build React frontend ===" -ForegroundColor Cyan
Set-Location "$root\frontend"
npm run build
if (-not $?) { Write-Host "Frontend build failed" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "=== Step 2/3: Install PyInstaller ===" -ForegroundColor Cyan
Set-Location $root
C:\Users\z003y7cj\miniconda3\python.exe -m pip install pyinstaller --quiet

Write-Host ""
Write-Host "=== Step 3/3: Build executable ===" -ForegroundColor Cyan
C:\Users\z003y7cj\miniconda3\python.exe -m PyInstaller turbine-analyzer.spec --noconfirm

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Green
Write-Host "Executable: $root\dist\turbine-analyzer\turbine-analyzer.exe"
Write-Host "Share the entire 'turbine-analyzer' folder to the user."
Write-Host "(A 'turbine-analyzer-data' folder will be created next to the .exe on first run)"
