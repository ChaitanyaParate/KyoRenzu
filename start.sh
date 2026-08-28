#!/bin/bash
# start.sh

echo "Starting FastAPI backend on port 8000..."
source venv/bin/activate
uvicorn api:app --host 0.0.0.0 --port 8000 "$@" &
API_PID=$!

echo "Starting Vite frontend..."
cd web
npm run dev &
FRONTEND_PID=$!

echo "Both servers are running."
echo "FastAPI API: http://localhost:8000"
echo "React Web App: http://localhost:5173"
echo "Press Ctrl+C to stop both."

function cleanup {
    echo "Stopping servers..."
    kill $API_PID
    kill $FRONTEND_PID
    exit 0
}

trap cleanup SIGINT SIGTERM

wait $API_PID
wait $FRONTEND_PID
