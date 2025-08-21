#!/bin/bash

# BufoIndex Site Run Script
# Installs dependencies, builds everything, and starts the development server

echo "🚀 Setting up and running BufoIndex site..."

# Step 1: Install npm dependencies
echo "📦 Installing npm dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ npm install failed"
    exit 1
fi

# Step 2: Build CSS
echo "🎨 Building CSS with TailwindCSS..."
npm run build:css

if [ $? -ne 0 ]; then
    echo "❌ CSS build failed"
    exit 1
fi

# Step 3: Test Hugo build
echo "🔨 Testing Hugo build..."
hugo --gc --minify --destination public-test

if [ $? -ne 0 ]; then
    echo "❌ Hugo build failed"
    exit 1
fi

echo "🧪 Cleaning up test build..."
rm -rf public-test

echo "✅ Build complete! Starting development server..."
echo ""
echo "🌐 Hugo server will start on http://localhost:1313"
echo "   Press Ctrl+C to stop the server"
echo ""

# Step 4: Start Hugo development server
hugo server -D