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
import { UserMenu } from '../auth/UserMenu';
import { useThemeContext } from '../../contexts/ThemeContext';

interface NavButtonProps {
  to: string;
  label: string;
  onClick?: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({ to, label, onClick }) => {
  const location = useLocation();
  const isActive = to === '/'
    ? location.pathname === '/'
    : location.pathname.startsWith(to);

  return (
    <Button
      component={Link}
      to={to}
      onClick={onClick}
      sx={{
        color: isActive ? '#fff' : 'rgba(255,255,255,0.72)',
        borderBottom: '2px solid',
        borderColor: isActive ? '#1fb878' : 'transparent',
        borderRadius: 0,
        px: 1.75,
        py: '18px',
        textTransform: 'none',
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontSize: 13,
        fontWeight: isActive ? 600 : 500,
        minWidth: 'auto',
        '&:hover': {
          color: '#fff',
          backgroundColor: 'rgba(255,255,255,0.04)',
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
    { to: '/projects', label: 'Projects' },
    { to: '/tools', label: 'Tools' },
    { to: '/wiki', label: 'Wiki / Docs' },
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
      elevation={0}
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backgroundColor: '#0d1117',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <Toolbar sx={{ gap: 1.75, minHeight: '56px !important', height: 56, color: '#fff' }}>
        <Logo />

        {isMobile ? (
          <>
            <Box sx={{ flexGrow: 1 }} />
            <ThemeToggle mode={mode} onToggle={toggleTheme} />
            <UserMenu />
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
            <Box sx={{ display: 'flex', gap: '2px', flex: 1, ml: 1 }}>
              {navItems.map((item) => (
                <NavButton key={item.to} to={item.to} label={item.label} />
              ))}
            </Box>
            {isOnDatalakePage && (
              <Tooltip title="Refresh runs">
                <IconButton
                  onClick={() => window.location.reload()}
                  sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff' } }}
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
                fontSize: 13,
                backgroundColor: '#2f4ea8',
                color: '#fff',
                borderRadius: '5px',
                '&:hover': {
                  backgroundColor: '#233e8c',
                },
              }}
            >
              Upload
            </Button>
            <ThemeToggle mode={mode} onToggle={toggleTheme} />
            <UserMenu />
          </>
        )}
      </Toolbar>
    </AppBar>
  );
};
