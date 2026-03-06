# Network Access Configuration

## ✅ Current Status
Both servers are configured and running with network access enabled!

## 🌐 Access URLs

### From this computer (big_msi):
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000/docs

### From other computers on the network:
- **Frontend**: http://10.20.146.177:3000
- **Backend API**: http://10.20.146.177:8000/docs

## 🚀 Starting the Servers

### Quick Start (Recommended):
```bash
./start-network.sh
```

### Manual Start:
```bash
# Terminal 1 - Backend
python -m uvicorn mddatalake.api.main:app --host 0.0.0.0 --port 8000

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## 🛑 Stopping the Servers

### Quick Stop:
```bash
./stop-network.sh
```

### Manual Stop:
Press `Ctrl+C` in each terminal

## 🔧 Configuration Details

### Frontend (Vite - Port 3000)
- **File**: `frontend/vite.config.ts`
- **Config**: `host: '0.0.0.0'` ✅ Already configured
- **Binding**: Listening on all network interfaces

### Backend (FastAPI - Port 8000)
- **Command**: `uvicorn ... --host 0.0.0.0 --port 8000`
- **Binding**: Listening on all network interfaces

## 🔥 Firewall Notes

If you can't access from other computers, check firewall:
```bash
# Check if ports are open
sudo ufw status

# Allow ports if needed
sudo ufw allow 3000/tcp
sudo ufw allow 8000/tcp
```

## 🧪 Testing Connectivity

### From big_msi (test local network binding):
```bash
curl http://10.20.146.177:3000
curl http://10.20.146.177:8000/docs
```

### From another computer (pckr258):
```bash
curl http://10.20.146.177:3000
# Or open in browser: http://10.20.146.177:3000
```

## 📝 Current Network Configuration
- **LAN IP**: 10.20.146.177
- **Frontend Port**: 3000 (bound to 0.0.0.0) ✅
- **Backend Port**: 8000 (bound to 0.0.0.0) ✅
- **API Proxy**: Fixed to point to localhost:8000 ✅

## ✨ All Set!
The application is now accessible from any computer on the local network at:
**http://10.20.146.177:3000**
