#!/bin/bash
# Start MD Datalake for network access
# This script starts both backend and frontend servers accessible on the local network

set -e

# Get the LAN IP address
LAN_IP=$(hostname -I | awk '{print $1}')
echo "🌐 Starting MD Datalake on network..."
echo "📍 LAN IP: $LAN_IP"
echo ""

# Start backend in background
echo "🚀 Starting backend API on 0.0.0.0:8000..."
cd "$(dirname "$0")"
python -m uvicorn mddatalake.api.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"
echo ""

# Wait for backend to be ready
echo "⏳ Waiting for backend to be ready..."
sleep 3

# Start frontend in background
echo "🚀 Starting frontend dev server on 0.0.0.0:3000..."
cd frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"
echo ""

# Save PIDs for cleanup
echo "$BACKEND_PID" > ../backend.pid
echo "$FRONTEND_PID" > ../frontend.pid

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ MD Datalake is now running!"
echo ""
echo "📱 Access from this computer:"
echo "   http://localhost:3000"
echo ""
echo "🌐 Access from other computers on the network:"
echo "   http://$LAN_IP:3000"
echo ""
echo "🔧 Backend API:"
echo "   http://$LAN_IP:8000/docs (Swagger UI)"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f backend.log"
echo "   Frontend: tail -f frontend.log"
echo ""
echo "🛑 To stop the servers:"
echo "   ./stop-network.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
