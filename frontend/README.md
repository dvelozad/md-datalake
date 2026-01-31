# MD Simulation Database - Frontend

Interactive web application for browsing and visualizing molecular dynamics simulations.

## Features

### 🔍 Run Browser
- Grid view of simulation runs with thumbnail previews
- Advanced filtering (ensemble, temperature, pressure, composition, engine)
- Pagination for large datasets
- Quick preview on hover

### 🎬 Trajectory Visualization
- **NGL Viewer** integration for 3D molecular graphics
- **MDsrv** streaming for large trajectory files (>500 MB)
- Multiple representation styles (ball+stick, cartoon, surface, spacefill, etc.)
- Synchronized frame playback
- Adjustable playback speed (0.5×, 1×, 2×, 4×)

### 📊 Property Visualization
- **Plotly.js** time-series plots for observables (T, P, energy, etc.)
- Synchronized with trajectory viewer (vertical marker)
- Interactive zoom/pan
- Click on plot to jump to specific frame

### 👥 Collaborative Viewing
- Shared sessions via unique URL
- Synchronized frame viewing across multiple users
- Session timeout management (1 hour default)
- Real-time connection status

## Technology Stack

### Core Libraries
- **React 18+** with TypeScript
- **Material-UI (MUI)** for UI components
- **NGL Viewer** for molecular graphics
- **Plotly.js** for time-series plots
- **React Router** for navigation
- **TanStack Query** for server state management
- **Zustand** for client state management
- **Axios** for HTTP requests

### Build Tools
- **Vite** for fast development and optimized builds
- **TypeScript** for type safety
- **ESLint** for code quality

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── visualization/
│   │   │   ├── NGLViewerWrapper.tsx    # 3D molecular viewer
│   │   │   ├── FrameControls.tsx       # Playback controls
│   │   │   ├── StyleSelector.tsx       # Representation styles
│   │   │   └── SessionStatus.tsx       # Connection status
│   │   ├── properties/
│   │   │   └── PropertyPlot.tsx        # Time-series plots
│   │   └── browser/
│   │       ├── RunBrowser.tsx          # Main browser view
│   │       ├── RunCard.tsx             # Run preview card
│   │       └── FilterPanel.tsx         # Search filters
│   ├── hooks/
│   │   ├── useMDservSession.ts         # Session lifecycle
│   │   └── useNGLStage.ts              # NGL stage management
│   ├── services/
│   │   ├── api.ts                      # FastAPI client
│   │   └── mdserv.ts                   # MDsrv WebSocket client
│   ├── types/
│   │   └── visualization.ts            # TypeScript types
│   ├── pages/
│   │   └── VisualizationPage.tsx       # Main visualization page
│   ├── App.tsx                         # Main app component
│   └── main.tsx                        # Entry point
├── package.json
├── vite.config.ts
├── tsconfig.json
├── Dockerfile
└── nginx.conf
```

## Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Install Dependencies
```bash
cd frontend
npm install
```

### Start Development Server
```bash
npm run dev
```

The app will be available at http://localhost:3000

### Build for Production
```bash
npm run build
```

### Run Linter
```bash
npm run lint
```

### Type Check
```bash
npm run type-check
```

## API Integration

The frontend communicates with the FastAPI backend through:

### REST Endpoints
- `GET /api/v1/runs` - List simulation runs with filters
- `GET /api/v1/runs/{id}` - Get run details
- `GET /api/v1/runs/{id}/artifacts` - List run artifacts
- `GET /api/v1/runs/{id}/observables` - Get observable data
- `POST /api/v1/runs/{id}/visualizations` - Create visualization session
- `GET /api/v1/visualizations/{session_id}` - Get session status
- `DELETE /api/v1/visualizations/{session_id}` - Terminate session

### WebSocket (MDsrv)
- `/mdserv/session/{session_id}` - WebSocket connection for frame streaming

## Environment Variables

Create a `.env` file:

```env
VITE_API_URL=http://localhost:8000
VITE_MDSERV_BASE=http://localhost:8090
```

## Docker Deployment

### Build Image
```bash
docker build -t mddatalake-frontend .
```

### Run Container
```bash
docker run -p 3000:80 \
  -e VITE_API_URL=http://api:8000 \
  -e VITE_MDSERV_BASE=http://localhost:8090 \
  mddatalake-frontend
```

## Key Components

### NGLViewerWrapper
3D molecular viewer component using NGL library.

**Features:**
- Frame-by-frame playback
- Multiple representation styles
- Automatic centering and zoom
- Synchronized with MDsrv frame updates

**Props:**
- `mdservClient: MDservClient | null` - MDsrv WebSocket client
- `trajectoryUrl?: string` - Trajectory file URL
- `topologyUrl?: string` - Topology file URL
- `currentFrame?: number` - Current frame index
- `representationType?: string` - Representation style
- `onFrameChange?: (frame: number) => void` - Frame change callback

### FrameControls
Playback controls for trajectory navigation.

**Features:**
- Play/pause button
- Frame scrubber (slider)
- Previous/next frame buttons
- Jump to first/last frame
- Playback speed control (0.5×, 1×, 2×, 4×)

**Props:**
- `mdservClient: MDservClient | null` - MDsrv client
- `frameCount: number` - Total number of frames
- `currentFrame: number` - Current frame index
- `onFrameChange: (frame: number) => void` - Frame change handler
- `fps?: number` - Frames per second (default: 30)

### PropertyPlot
Plotly-based time-series visualization for observables.

**Features:**
- Multiple observables on same plot
- Synchronized vertical marker at current frame
- Click to jump to frame
- Interactive zoom/pan

**Props:**
- `observables: Observable[]` - Array of observables
- `currentFrame: number` - Current frame index
- `onFrameClick?: (frame: number) => void` - Click handler
- `height?: number` - Plot height (default: 300)

### SessionStatus
Connection status indicator with session timer.

**Features:**
- Status chip (connected, disconnected, error)
- Session expiry countdown
- Progress bar showing time remaining
- Reconnect button

**Props:**
- `status: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'`
- `timeRemaining: number` - Milliseconds until expiry
- `onReconnect?: () => void` - Reconnect handler

### RunBrowser
Main browsing interface for simulation runs.

**Features:**
- Grid layout with responsive design
- Filter panel (ensemble, temperature, pressure, etc.)
- Pagination
- Loading states and error handling

**Props:**
- `onRunSelect: (runId: number) => void` - Run selection handler

## Custom Hooks

### useMDservSession
Manages visualization session lifecycle.

**Returns:**
- `session: CreateSessionResponse | null` - Session data
- `client: MDservClient | null` - WebSocket client
- `status: SessionStatus` - Connection status
- `error: Error | null` - Error state
- `timeRemaining: number` - Milliseconds until expiry
- `createSession: () => Promise<CreateSessionResponse>` - Create session
- `terminateSession: () => Promise<void>` - Terminate session
- `reconnect: () => Promise<void>` - Reconnect handler

### useNGLStage
Manages NGL Stage lifecycle and operations.

**Returns:**
- `stage: NGL.Stage | null` - NGL Stage instance
- `structureComponent: NGL.StructureComponent | null` - Loaded structure
- `isLoading: boolean` - Loading state
- `error: Error | null` - Error state
- `loadStructure: (url: string, format?: string) => Promise<StructureComponent>`
- `setRepresentation: (type: string, params?: any) => void`
- `setFrame: (frameIndex: number) => void`
- `getFrameCount: () => number`
- `getCurrentFrame: () => number`

## Performance Considerations

### Large Trajectory Files
- MDsrv streams only visible frames, not entire trajectory
- Client memory usage stays constant regardless of trajectory size
- Network bandwidth scales with playback speed

### Caching Strategy
- TanStack Query caches API responses for 5 minutes
- Trajectory metadata cached in session
- Thumbnail images cached by browser

### Optimization Tips
1. Use `medium` quality for NGL Viewer (balance between quality and performance)
2. Limit observable data to relevant properties
3. Enable pagination for large run lists
4. Use WebSocket reconnection with exponential backoff

## Troubleshooting

### NGL Viewer not rendering
- Check browser console for WebGL errors
- Ensure topology file is accessible
- Verify NGL library is loaded

### MDsrv connection failed
- Check MDsrv service is running
- Verify session ID is valid
- Check firewall/proxy settings

### Property plots not synchronized
- Ensure frame indices match between trajectory and observables
- Check time_series array lengths

### Session expired
- Default timeout is 1 hour
- Click reconnect to create new session
- Check backend session cleanup task

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

**Required features:**
- WebGL 2.0
- WebSocket
- ES2020

## Contributing

See main project [CONTRIBUTING.md](../CONTRIBUTING.md)

## License

See main project [LICENSE](../LICENSE)
