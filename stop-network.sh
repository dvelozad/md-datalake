#!/bin/bash
# Stop MD Datalake servers

echo "🛑 Stopping MD Datalake servers..."

# Stop backend
if [ -f backend.pid ]; then
    BACKEND_PID=$(cat backend.pid)
    if kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID"
        echo "✅ Backend stopped (PID: $BACKEND_PID)"
    fi
    rm backend.pid
fi

# Stop frontend
if [ -f frontend.pid ]; then
    FRONTEND_PID=$(cat frontend.pid)
    if kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID"
        echo "✅ Frontend stopped (PID: $FRONTEND_PID)"
    fi
    rm frontend.pid
fi

echo "✅ All servers stopped!"
