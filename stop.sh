#!/bin/bash
# BestWishes - Simple Stop Script
# Only kills processes on ports 3003 and 8002 that are NOT docker

cd "$(dirname "$0")"

echo "Stopping BestWishes..."

# Stop backend on 8002
PID=$(netstat -tlnp 2>/dev/null | grep ":8002 " | grep -v docker | awk '{print $7}' | cut -d'/' -f1)
if [ -n "$PID" ]; then
  echo "  Stopping backend (PID $PID)..."
  kill $PID 2>/dev/null
fi

# Stop frontend on 3003
PID=$(netstat -tlnp 2>/dev/null | grep ":3003 " | grep -v docker | awk '{print $7}' | cut -d'/' -f1)
if [ -n "$PID" ]; then
  echo "  Stopping frontend (PID $PID)..."
  kill $PID 2>/dev/null
fi

echo "Done."
