import { Box, Typography } from '@mui/material';
import { Link } from 'react-router-dom';

export const Logo: React.FC = () => {
  return (
    <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* 3x3 lattice mark — 8 currentColor rects + 1 phosphor green center */}
        <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          {[
            [4, 4],  [14, 4],  [24, 4],
            [4, 14],            [24, 14],
            [4, 24], [14, 24], [24, 24],
          ].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width="4" height="4" rx="0.5" fill="currentColor" />
          ))}
          <rect x="14" y="14" width="4" height="4" rx="0.5" fill="#1fb878" />
        </svg>
        <Typography
          sx={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            display: { xs: 'none', sm: 'block' },
          }}
        >
          Tessera
        </Typography>
      </Box>
    </Link>
  );
};
