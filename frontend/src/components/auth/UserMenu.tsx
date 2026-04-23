import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar, IconButton, Menu, MenuItem, ListItemIcon, Divider, Typography, Box,
} from '@mui/material';
import { Person, Lock, AdminPanelSettings, Logout } from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';

export const UserMenu: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  if (!user) return null;

  const initials = (user.full_name || user.email)
    .split(' ')
    .slice(0, 2)
    .map(s => s[0])
    .join('')
    .toUpperCase();

  return (
    <>
      <IconButton onClick={(e) => setAnchor(e.currentTarget)} size="small" sx={{ ml: 1 }}>
        <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: 'primary.main' }}>
          {initials}
        </Avatar>
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2">{user.full_name || user.email}</Typography>
          <Typography variant="caption" color="text.secondary">{user.role}</Typography>
        </Box>
        <Divider />
        <MenuItem onClick={() => { setAnchor(null); navigate('/profile'); }}>
          <ListItemIcon><Person fontSize="small" /></ListItemIcon>
          Profile
        </MenuItem>
        <MenuItem onClick={() => { setAnchor(null); navigate('/change-password'); }}>
          <ListItemIcon><Lock fontSize="small" /></ListItemIcon>
          Change Password
        </MenuItem>
        {isAdmin && (
          <MenuItem onClick={() => { setAnchor(null); navigate('/admin/users'); }}>
            <ListItemIcon><AdminPanelSettings fontSize="small" /></ListItemIcon>
            Manage Users
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={() => { setAnchor(null); logout(); navigate('/login'); }}>
          <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
          Logout
        </MenuItem>
      </Menu>
    </>
  );
};
