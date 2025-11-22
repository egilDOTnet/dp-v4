#!/bin/bash
# Helper script to kill processes on a specific port

PORT=${1:-3001}

if [ -z "$PORT" ]; then
  echo "Usage: ./scripts/kill-port.sh [port]"
  echo "Example: ./scripts/kill-port.sh 3001"
  exit 1
fi

PID=$(lsof -ti:$PORT)

if [ -z "$PID" ]; then
  echo "No process found on port $PORT"
  exit 0
fi

echo "Killing process $PID on port $PORT..."
kill -9 $PID
sleep 1

if lsof -ti:$PORT > /dev/null 2>&1; then
  echo "Failed to kill process on port $PORT"
  exit 1
else
  echo "Port $PORT is now free"
fi

