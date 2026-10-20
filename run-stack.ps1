# 1. Verify Docker is installed via the built-in Windows Package Manager
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "📦 Installing Docker Desktop via Microsoft Winget..." -ForegroundColor Cyan
    winget install --id Docker.DockerDesktop -e --accept-source-agreements --accept-package-agreements
    Write-Host "🛑 Docker installed! Please launch 'Docker Desktop' from your Start Menu, then re-run this script." -ForegroundColor Yellow
    Exit
}

# 2. Replicate the 'make setup' behavior natively on Windows
Write-Host "📂 Structuring persistent data volume mappings..." -ForegroundColor Green
New-Item -ItemType Directory -Force -Path ".\data"

# 3. Stop running container blocks
Write-Host "🧹 Purging active application containers..." -ForegroundColor Yellow
docker stop ct-mapper-prod 2>$null
docker rm ct-mapper-prod 2>$null

# 4. Recompile and start the standalone bundle
Write-Host "🐳 Building and launching production container stack..." -ForegroundColor Green
docker build --no-cache -t webnx-ct-mapper .
docker run -d -p 3000:3000 -v "${PWD}/data:/app/data" --name ct-mapper-prod webnx-ct-mapper

Write-Host "🚀 Stack is fully live! Open: http://localhost:3000" -ForegroundColor Green
