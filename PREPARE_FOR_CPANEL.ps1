# Active Zone Hub - cPanel File Preparation Script
# This script helps you prepare files for cPanel upload

$ProjectDir = "C:\Users\HP\OneDrive\Documents\Active"
$DeploymentDir = "$ProjectDir\cpanel-deployment"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Active Zone Hub - cPanel File Prep" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Create deployment directory
Write-Host "[1/4] Creating deployment folder..." -ForegroundColor Yellow
if (Test-Path $DeploymentDir) {
    Remove-Item $DeploymentDir -Recurse -Force
}
New-Item -ItemType Directory -Path $DeploymentDir | Out-Null
Write-Host "OK - Created: $DeploymentDir" -ForegroundColor Green
Write-Host ""

# Copy backend files
Write-Host "[2/4] Copying backend files..." -ForegroundColor Yellow
Copy-Item "$ProjectDir\server.js" -Destination $DeploymentDir -ErrorAction SilentlyContinue
Copy-Item "$ProjectDir\package.json" -Destination $DeploymentDir -ErrorAction SilentlyContinue
Copy-Item "$ProjectDir\.env" -Destination $DeploymentDir -ErrorAction SilentlyContinue
Copy-Item "$ProjectDir\database" -Destination $DeploymentDir -Recurse -ErrorAction SilentlyContinue
Write-Host "OK - Backend files copied" -ForegroundColor Green
Write-Host ""

# Copy frontend files
Write-Host "[3/4] Copying frontend files..." -ForegroundColor Yellow
Copy-Item "$ProjectDir\*.html" -Destination $DeploymentDir -ErrorAction SilentlyContinue
Copy-Item "$ProjectDir\src" -Destination $DeploymentDir -Recurse -ErrorAction SilentlyContinue

# Copy images if exists
if (Test-Path "$ProjectDir\images") {
    Copy-Item "$ProjectDir\images" -Destination $DeploymentDir -Recurse -ErrorAction SilentlyContinue
}

Write-Host "OK - Frontend files copied" -ForegroundColor Green
Write-Host ""

# Create README
Write-Host "[4/4] Creating upload instructions..." -ForegroundColor Yellow

$readmeContent = @"
================================================================================
           UPLOAD THESE FILES TO YOUR CPANEL HOSTING
================================================================================

UPLOAD LOCATION:
- cPanel File Manager: /home/yourusername/active-zone-hub/
- OR use FTP/SFTP to upload to the same location

WHAT'S INCLUDED:
- server.js (Backend Node.js application)
- package.json (Dependencies list)
- .env (Configuration file - UPDATE with your credentials!)
- database/schema.sql (MySQL database structure)
- All HTML files (index, store, checkout, etc.)
- src/ folder (JavaScript files)
- images/ folder (Image assets if any)

IMPORTANT - BEFORE UPLOADING:
1. Edit the .env file and update with YOUR actual values:
   - Database credentials from cPanel MySQL
   - Your domain URL
   - Paystack LIVE API keys
   - TOTP secret for Google Authenticator

2. DO NOT upload:
   - node_modules/ (will be created on server)
   - This README file

AFTER UPLOADING:
1. Create MySQL database in cPanel and import schema.sql
2. Setup Node.js App in cPanel (point to server.js)
3. Run NPM Install in cPanel Node.js interface
4. Start the application

FULL INSTRUCTIONS:
See: CPANEL_DEPLOYMENT_GUIDE.txt in the original project folder

================================================================================
"@

Set-Content -Path "$DeploymentDir\README_UPLOAD_INSTRUCTIONS.txt" -Value $readmeContent
Write-Host "OK - Instructions created" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DEPLOYMENT FILES READY!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "All files prepared in:" -ForegroundColor White
Write-Host "  $DeploymentDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Review and edit .env file with your credentials" -ForegroundColor White
Write-Host "  2. Upload ALL files from the cpanel-deployment folder" -ForegroundColor White
Write-Host "  3. Follow CPANEL_DEPLOYMENT_GUIDE.txt for setup" -ForegroundColor White
Write-Host ""
Write-Host "Opening deployment folder..." -ForegroundColor Gray
Start-Process explorer.exe -ArgumentList $DeploymentDir
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
