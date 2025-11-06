#!/bin/bash

echo "🚀 Installing TTS Donation System..."

# Install backend dependencies
echo "📦 Installing backend dependencies..."
npm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p public/audios
mkdir -p config

# Set permissions for audio directory
chmod 755 public/audios

echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "1. Add your Telegram bot token to .env file"
echo "2. Place your Google Cloud TTS JSON key in config/google-tts.json"
echo "3. Run 'npm run dev' to start the backend"
echo "4. In another terminal, run 'cd frontend && npm run dev' to start the frontend"