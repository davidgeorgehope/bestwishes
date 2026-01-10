#!/bin/bash
# BestWishes - Simple Start Script
# Ports: Frontend 3003, Backend 8002

cd "$(dirname "$0")"

echo "Starting BestWishes..."

# Backend
if ! netstat -tlnp 2>/dev/null | grep -q ":8002 "; then
  echo "  Starting backend on 8002..."
  cd backend && source venv/bin/activate
  nohup uvicorn main:app --host 127.0.0.1 --port 8002 > /tmp/bestwishes-backend.log 2>&1 &
  echo $! > ../pids/backend.pid
  echo "8002" > ../pids/backend.port
  cd ..
  sleep 2
else
  echo "  Backend already running on 8002"
fi

# Frontend
if ! netstat -tlnp 2>/dev/null | grep -q ":3003 "; then
  echo "  Starting frontend on 3003..."
  cd frontend
  nohup npm run start -- -p 3003 > /tmp/bestwishes-frontend.log 2>&1 &
  echo $! > ../pids/frontend.pid
  echo "3003" > ../pids/frontend.port
  cd ..
  sleep 3
else
  echo "  Frontend already running on 3003"
fi

echo "Done. Check: http://localhost:3003"
