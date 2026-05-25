import React, { ReactNode } from 'react';
import { Box } from '@mui/material';
import { Navigation } from './Navigation';

interface AppLayoutProps {
  children: ReactNode;
}

const FOOTER_HEIGHT = 28;

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navigation />
      <Box
        component="main"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
          // Reserve space for the fixed footer
          pb: `${FOOTER_HEIGHT}px`,
        }}
      >
        {children}
      </Box>
      {/* Affiliation footer — fixed to bottom of viewport */}
      <Box
        component="footer"
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: FOOTER_HEIGHT,
          zIndex: (theme) => theme.zIndex.drawer + 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: '18px',
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.default',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '9.5px',
          fontWeight: 500,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: 'text.secondary',
          lineHeight: 1,
        }}
      >
        <Box
          component="span"
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: '#1fb878',
            boxShadow: '0 0 0 3px rgba(31, 184, 120, 0.12)',
            flexShrink: 0,
          }}
        />
        <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
          Cortes-Huerto Group
        </Box>
        <Box component="span" sx={{ color: 'text.secondary' }}>
          ·
        </Box>
        <Box
          component="span"
          sx={{ display: { xs: 'none', sm: 'inline' } }}
        >
          Max Planck Institute for Polymer Research
        </Box>
        <Box
          component="span"
          sx={{ display: { xs: 'none', sm: 'inline' }, color: 'text.secondary' }}
        >
          ·
        </Box>
        <Box component="span">
          Mainz
        </Box>
      </Box>
    </Box>
  );
};
