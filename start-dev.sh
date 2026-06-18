#!/bin/bash

echo "🚀 FitLog 로컬 개발 서버 시작..."
echo ""

# 현재 와이파이 IP 확인
IP=$(ipconfig getifaddr en0)
echo "📡 현재 IP: $IP"
echo "   api.ts의 API_URL이 http://$IP:8080 인지 확인하세요!"
echo ""

cd "$(dirname "$0")/backend"
./gradlew bootRun
