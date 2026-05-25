import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, TextField, Button, Typography,
  Alert, CircularProgress, Stack, useMediaQuery, useTheme,
} from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';

const BondGridBg = () => (
  <svg
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    preserveAspectRatio="xMidYMid slice"
    viewBox="0 0 80 80"
  >
    <defs>
      <pattern id="bond-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
        <line x1="0" y1="20" x2="40" y2="20" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <line x1="20" y1="0" x2="20" y2="40" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <circle cx="20" cy="20" r="1.2" fill="rgba(255,255,255,0.1)" />
        <circle cx="0" cy="0" r="1.2" fill="rgba(255,255,255,0.1)" />
        <circle cx="40" cy="0" r="1.2" fill="rgba(255,255,255,0.1)" />
        <circle cx="0" cy="40" r="1.2" fill="rgba(255,255,255,0.1)" />
        <circle cx="40" cy="40" r="1.2" fill="rgba(255,255,255,0.1)" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#bond-grid)" />
  </svg>
);

const TesseraLogo: React.FC<{ size?: number; color?: string }> = ({ size = 26, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    {[
      [4, 4],  [14, 4],  [24, 4],
      [4, 14],            [24, 14],
      [4, 24], [14, 24], [24, 24],
    ].map(([x, y], i) => (
      <rect key={i} x={x} y={y} width="4" height="4" rx="0.5" fill={color} />
    ))}
    <rect x="14" y="14" width="4" height="4" rx="0.5" fill="#1fb878" />
  </svg>
);

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
      {/* Left — form panel */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          px: { xs: 4, md: 7 },
          py: 6,
          maxWidth: 480,
          width: '100%',
          mx: 'auto',
        }}
      >
        <Box sx={{ color: '#181d23', mb: 2 }}>
          <TesseraLogo size={32} color="#181d23" />
        </Box>
        <Typography
          variant="h5"
          sx={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontWeight: 700,
            mt: 1,
          }}
        >
          Sign in to Tessera
        </Typography>
        <Typography
          sx={{
            fontSize: 13,
            color: 'text.secondary',
            mt: 0.5,
          }}
        >
          Cortes-Huerto Group · MPI for Polymer Research
        </Typography>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

        <form onSubmit={handleSubmit}>
          <Stack spacing={2} sx={{ mt: 3 }}>
            <TextField
              label="Email"
              type="email"
              fullWidth
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              size="small"
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              size="small"
            />
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mt: 1 }}>
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
                sx={{
                  backgroundColor: '#2f4ea8',
                  borderRadius: '5px',
                  fontWeight: 600,
                  '&:hover': { backgroundColor: '#233e8c' },
                }}
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>
              <Typography
                component="a"
                href="#"
                sx={{
                  fontSize: 13,
                  color: 'primary.main',
                  textDecoration: 'underline',
                  textUnderlineOffset: '0.2em',
                }}
              >
                Reset password
              </Typography>
            </Box>
          </Stack>
        </form>
      </Box>

      {/* Right — branded panel */}
      {!isMobile && (
        <Box
          sx={{
            position: 'relative',
            background: 'linear-gradient(180deg, #0d1117 0%, #142254 100%)',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            p: 6,
            overflow: 'hidden',
          }}
        >
          <BondGridBg />
          <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 460 }}>
            <Typography
              sx={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#a3f2c8',
              }}
            >
              Tessera · molecular datalake
            </Typography>
            <Typography
              sx={{
                fontFamily: "'IBM Plex Serif', Georgia, serif",
                fontSize: 26,
                lineHeight: 1.25,
                fontWeight: 500,
                mt: 1.25,
              }}
            >
              An open archive of the lab's simulation work — runs, observables, and the inputs that produced them.
            </Typography>
            <Typography
              sx={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 12,
                letterSpacing: '0.08em',
                color: '#a3f2c8',
                mt: 2,
              }}
            >
              MD · MC · H-AdResS · LAMMPS · GROMACS
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
};
