import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Box,
  Button,
  IconButton,
  useMediaQuery,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  useTheme,
  Tooltip,
} from '@mui/material';
import { Menu as MenuIcon, Close as CloseIcon, Refresh, CloudUpload } from '@mui/icons-material';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { ThemeToggle } from '../ThemeToggle';
import { useThemeContext } from '../../contexts/ThemeContext';

interface NavButtonProps {
  to: string;
  label: string;
  onClick?: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({ to, label, onClick }) => {
  const location = useLocation();
  const theme = useTheme();
  const isActive = to === '/'
    ? location.pathname === '/'
    : location.pathname.startsWith(to);

  return (
    <Button
      component={Link}
      to={to}
      onClick={onClick}
      sx={{
        color: theme.palette.mode === 'dark'
          ? (isActive ? 'primary.main' : 'inherit')
          : 'white',
        borderBottom: isActive ? 2 : 0,
        borderColor: theme.palette.mode === 'dark' ? 'primary.main' : 'white',
        borderRadius: 0,
        px: 2,
        py: 1,
        textTransform: 'none',
        fontWeight: isActive ? 600 : 400,
        opacity: (theme.palette.mode === 'light' && !isActive) ? 0.85 : 1,
        '&:hover': {
          backgroundColor: 'action.hover',
          opacity: 1,
        },
      }}
    >
      {label}
    </Button>
  );
};

export const Navigation: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { mode, toggleTheme } = useThemeContext();

  const isOnDatalakePage = location.pathname === '/';

  const navItems = [
    { to: '/', label: 'Datalake' },
    { to: '/tools', label: 'Tools' },
    { to: '/wiki', label: 'Wiki/Docs' },
    { to: '/about', label: 'About' },
  ];

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleNavClick = () => {
    setDrawerOpen(false);
  };

  return (
    <AppBar
      position="sticky"
      elevation={1}
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backgroundColor: theme.palette.mode === 'dark' ? 'background.paper' : 'primary.main',
      }}
    >
      <Toolbar sx={{ gap: 2 }}>
        <Logo />

        {isMobile ? (
          <>
            <Box sx={{ flexGrow: 1 }} />
            <ThemeToggle mode={mode} onToggle={toggleTheme} />
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="end"
              onClick={handleDrawerToggle}
              sx={{ ml: 1 }}
            >
              <MenuIcon />
            </IconButton>
            <Drawer
              anchor="right"
              open={drawerOpen}
              onClose={handleDrawerToggle}
              sx={{
                '& .MuiDrawer-paper': {
                  width: 250,
                  pt: 2,
                },
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 2, pb: 1 }}>
                <IconButton onClick={handleDrawerToggle}>
                  <CloseIcon />
                </IconButton>
              </Box>
              <Divider />
              <List>
                {navItems.map((item) => (
                  <ListItem key={item.to} disablePadding>
                    <ListItemButton
                      component={Link}
                      to={item.to}
                      onClick={handleNavClick}
                    >
                      <ListItemText primary={item.label} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Drawer>
          </>
        ) : (
          <>
            <Box sx={{ display: 'flex', gap: 1, flex: 1, ml: 2 }}>
              {navItems.map((item) => (
                <NavButton key={item.to} to={item.to} label={item.label} />
              ))}
            </Box>
            {isOnDatalakePage && (
              <Tooltip title="Refresh runs">
                <IconButton
                  onClick={() => window.location.reload()}
                  color="inherit"
                  size="medium"
                >
                  <Refresh />
                </IconButton>
              </Tooltip>
            )}
            <Button
              variant="contained"
              startIcon={<CloudUpload />}
              onClick={() => navigate('/upload')}
              size="small"
              sx={{
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Upload
            </Button>
            <ThemeToggle mode={mode} onToggle={toggleTheme} />
          </>
        )}
      </Toolbar>
    </AppBar>
  );
};
