# Deploy Active Zone Hub to AWS EC2
# This script creates a clean deployment package and uploads it

$EC2_HOST = "ubuntu@ec2-13-53-41-234.eu-north-1.compute.amazonaws.com"
$SSH_KEY = "$env:USERPROFILE\.ssh\active-zone-hub-lagos.pem"
$PROJECT_DIR = "C:\Users\HP\OneDrive\Documents\Active"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Active Zone Hub - EC2 Deployment Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Test SSH connection
Write-Host "[1/5] Testing SSH connection..." -ForegroundColor Yellow
$testConnection = ssh -i $SSH_KEY -o ConnectTimeout=10 $EC2_HOST "echo 'Connection successful'" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ SSH connection successful" -ForegroundColor Green
} else {
    Write-Host "✗ SSH connection failed. Please check:" -ForegroundColor Red
    Write-Host "  - EC2 instance is running" -ForegroundColor Red
    Write-Host "  - Security group allows SSH (port 22) from your IP" -ForegroundColor Red
    Write-Host "  - SSH key path is correct" -ForegroundColor Red
    exit 1
}

# Step 2: Create deployment directory on EC2
Write-Host "[2/5] Creating deployment directory on EC2..." -ForegroundColor Yellow
ssh -i $SSH_KEY $EC2_HOST "mkdir -p ~/active-zone-hub"
Write-Host "✓ Directory created" -ForegroundColor Green

# Step 3: Upload only essential files
Write-Host "[3/5] Uploading application files..." -ForegroundColor Yellow

# List of files to upload
$filesToUpload = @(
    "server.js",
    "package.json",
    ".env.example",
    "index.html",
    "about.html",
    "cart.html",
    "checkout.html",
    "contact.html",
    "orders.html",
    "payment-success.html",
    "services.html",
    "store.html"
)

# List of directories to upload
$dirsToUpload = @(
    "src",
    "css",
    "images",
    "database"
)

# Upload files
foreach ($file in $filesToUpload) {
    if (Test-Path "$PROJECT_DIR\$file") {
        Write-Host "  Uploading $file..." -ForegroundColor Gray
        scp -i $SSH_KEY "$PROJECT_DIR\$file" "${EC2_HOST}:~/active-zone-hub/" 2>$null
    }
}

# Upload directories
foreach ($dir in $dirsToUpload) {
    if (Test-Path "$PROJECT_DIR\$dir") {
        Write-Host "  Uploading $dir/..." -ForegroundColor Gray
        scp -i $SSH_KEY -r "$PROJECT_DIR\$dir" "${EC2_HOST}:~/active-zone-hub/" 2>$null
    }
}

Write-Host "✓ Files uploaded successfully" -ForegroundColor Green

# Step 4: Display next steps
Write-Host ""
Write-Host "[4/5] Next steps to complete deployment:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Connect to EC2:" -ForegroundColor White
Write-Host "   ssh -i $SSH_KEY $EC2_HOST" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Navigate to project directory:" -ForegroundColor White
Write-Host "   cd ~/active-zone-hub" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Install dependencies:" -ForegroundColor White
Write-Host "   npm install --production" -ForegroundColor Cyan
Write-Host ""
Write-Host "4. Create .env file:" -ForegroundColor White
Write-Host "   nano .env" -ForegroundColor Cyan
Write-Host ""
Write-Host "5. Start the application:" -ForegroundColor White
Write-Host "   pm2 start server.js --name active-zone-hub" -ForegroundColor Cyan
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Would you like to connect to EC2 now? (Y/N)" -ForegroundColor Yellow

$response = Read-Host
if ($response -eq "Y" -or $response -eq "y") {
    Write-Host "Connecting to EC2..." -ForegroundColor Green
    ssh -i $SSH_KEY $EC2_HOST
} else {
    Write-Host "Deployment package uploaded. Connect manually when ready." -ForegroundColor Green
}
