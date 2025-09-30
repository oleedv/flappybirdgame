@echo off
echo 🚀 Starting build process...

echo 📦 Installing frontend dependencies...
call npm ci

echo 📦 Installing backend dependencies...
cd backend
call npm ci
cd ..

echo 🏗️ Building React application...
call npm run build

echo 📂 Setting up production files...
if exist "backend\build" rmdir /s /q "backend\build"
xcopy /e /i "build" "backend\build"

echo ✅ Build complete! Ready for deployment.