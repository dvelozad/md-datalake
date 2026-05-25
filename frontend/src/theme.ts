import { createTheme, ThemeOptions } from '@mui/material';

const baseTheme: ThemeOptions = {
  typography: {
    fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    h1: {
      fontFamily: "'IBM Plex Serif', Georgia, serif",
      fontWeight: 600,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontFamily: "'IBM Plex Serif', Georgia, serif",
      fontWeight: 600,
      letterSpacing: '-0.02em',
    },
    h3: {
      fontFamily: "'IBM Plex Serif', Georgia, serif",
      fontWeight: 600,
      letterSpacing: '-0.02em',
    },
    h4: {
      fontFamily: "'IBM Plex Sans', sans-serif",
      fontWeight: 600,
    },
    h5: {
      fontFamily: "'IBM Plex Sans', sans-serif",
      fontWeight: 600,
    },
    h6: {
      fontFamily: "'IBM Plex Sans', sans-serif",
      fontWeight: 600,
    },
    button: {
      textTransform: 'none' as const,
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 5,
          textTransform: 'none' as const,
          fontWeight: 600,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        containedPrimary: {
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
          '&:hover': {
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          boxShadow: '0 1px 0 rgba(20, 34, 84, 0.04), 0 1px 2px rgba(20, 34, 84, 0.06)',
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: '56px !important',
          height: 56,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          fontFamily: "'IBM Plex Mono', monospace",
          fontWeight: 600,
        },
      },
    },
  },
};

export const lightTheme = createTheme({
  ...baseTheme,
  palette: {
    mode: 'light',
    primary: {
      main: '#2f4ea8',
      light: '#4f6cbe',
      dark: '#233e8c',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#1fb878',
      light: '#5fdca0',
      dark: '#16936a',
      contrastText: '#0d1117',
    },
    error: {
      main: '#d63b3b',
    },
    warning: {
      main: '#f5921b',
    },
    success: {
      main: '#1fb878',
    },
    info: {
      main: '#2086d4',
    },
    background: {
      default: '#f6f7f8',
      paper: '#ffffff',
    },
    text: {
      primary: '#181d23',
      secondary: '#5d6975',
    },
    divider: '#d6dbe0',
  },
});

export const darkTheme = createTheme({
  ...baseTheme,
  palette: {
    mode: 'dark',
    primary: {
      main: '#6f8bdb',
      light: '#8aa1e3',
      dark: '#5670c4',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#1fb878',
      light: '#5fdca0',
      dark: '#16936a',
      contrastText: '#0d1117',
    },
    error: {
      main: '#d63b3b',
    },
    warning: {
      main: '#f5921b',
    },
    success: {
      main: '#1fb878',
    },
    info: {
      main: '#2086d4',
    },
    background: {
      default: '#0d1117',
      paper: '#15191f',
    },
    text: {
      primary: '#e6eaf0',
      secondary: '#9aa3b1',
    },
    divider: '#2a313c',
  },
});
