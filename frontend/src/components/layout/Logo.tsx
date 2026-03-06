import { Box, Typography } from '@mui/material';
import { Link } from 'react-router-dom';

export const Logo: React.FC = () => {
  return (
    <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          {/* Central atom */}
          <circle cx="20" cy="20" r="5" fill="currentColor" />

          {/* Surrounding atoms */}
          <circle cx="10" cy="12" r="3" fill="currentColor" opacity="0.7" />
          <circle cx="30" cy="12" r="3" fill="currentColor" opacity="0.7" />
          <circle cx="8" cy="28" r="3" fill="currentColor" opacity="0.7" />
          <circle cx="32" cy="28" r="3" fill="currentColor" opacity="0.7" />

          {/* Bonds */}
          <line x1="20" y1="20" x2="10" y2="12" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
          <line x1="20" y1="20" x2="30" y2="12" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
          <line x1="20" y1="20" x2="8" y2="28" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
          <line x1="20" y1="20" x2="32" y2="28" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
        </svg>
        <Typography variant="h6" sx={{ fontWeight: 700, display: { xs: 'none', sm: 'block' } }}>
          MD Datalake
        </Typography>
      </Box>
    </Link>
  );
};
