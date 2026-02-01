import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { RunBrowser } from '@/components/browser/RunBrowser';
import { VisualizationPage } from '@/pages/VisualizationPage';
import { RunDetailPage } from '@/pages/RunDetailPage';
import { UploadPage } from '@/pages/UploadPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
});

function App() {
  const handleRunSelect = (runId: number) => {
    // Run selection is now handled by navigation to detail page
    console.log('Selected run:', runId);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RunBrowser onRunSelect={handleRunSelect} />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/runs/:runId" element={<RunDetailPage />} />
            <Route path="/runs/:runId/trajectory" element={<VisualizationPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
