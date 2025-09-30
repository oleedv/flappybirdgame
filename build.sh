#!/bin/bash

# Build script for Railway deployment
set -e

echo "🚀 Starting build process..."

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
npm ci

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm ci
cd ..

# Build the React app
echo "🏗️ Building React application..."
npm run build

# Move build files to backend for serving
echo "📂 Setting up production files..."
if [ -d "backend/build" ]; then
  rm -rf backend/build
fi
cp -r build backend/

echo "✅ Build complete! Ready for deployment."