import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { RunBrowserFixed } from '@/components/browser/RunBrowserFixed';
import { VisualizationPage } from '@/pages/VisualizationPage';
import { RunDetailPage } from '@/pages/RunDetailPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { ProjectDetailPage } from '@/pages/ProjectDetailPage';
import { UploadPage } from '@/pages/UploadPage';
import { ToolsPage } from '@/pages/ToolsPage';
import { WikiPage } from '@/pages/WikiPage';
import { AboutPage } from '@/pages/AboutPage';
import { LoginPage } from '@/pages/LoginPage';
import { UserManagementPage } from '@/pages/admin/UserManagementPage';
import { AppLayout } from '@/components/layout/AppLayout';
import { ThemeContextProvider, useThemeContext } from '@/contexts/ThemeContext';
import { AuthContextProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminRoute } from '@/components/auth/AdminRoute';
import { lightTheme, darkTheme } from '@/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function AppContent() {
  const { mode } = useThemeContext();
  const theme = mode === 'light' ? lightTheme : darkTheme;
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
            {/* Public route */}
            <Route path="/login" element={<LoginPage />} />
            {/* Protected routes */}
            <Route path="/*" element={
              <ProtectedRoute>
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<RunBrowserFixed onRunSelect={handleRunSelect} />} />
                    <Route path="/projects" element={<ProjectsPage />} />
                    <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
                    <Route path="/upload" element={<UploadPage />} />
                    <Route path="/runs/:runId" element={<RunDetailPage />} />
                    <Route path="/runs/:runId/trajectory" element={<VisualizationPage />} />
                    <Route path="/tools" element={<ToolsPage />} />
                    <Route path="/wiki" element={<WikiPage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/admin/users" element={<AdminRoute><UserManagementPage /></AdminRoute>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </AppLayout>
              </ProtectedRoute>
            } />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function App() {
  return (
    <ThemeContextProvider>
      <AuthContextProvider>
        <AppContent />
      </AuthContextProvider>
    </ThemeContextProvider>
  );
}

export default App;
