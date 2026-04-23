import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, FormControl,
  InputLabel, Alert, CircularProgress, Stack,
} from '@mui/material';
import { Add, Edit, PersonOff } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface User {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

const roleColor: Record<string, 'error' | 'primary' | 'default'> = {
  admin: 'error',
  contributor: 'primary',
  viewer: 'default',
};

export const UserManagementPage: React.FC = () => {
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState({ email: '', full_name: '', role: 'contributor', password: '' });
  const [error, setError] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn: () => axios.get('/api/v1/auth/users').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => axios.post('/api/v1/auth/users', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); setInviteOpen(false); setError(null); },
    onError: (err: any) => setError(err?.response?.data?.detail || 'Failed to create user'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<User> }) =>
      axios.patch(`/api/v1/auth/users/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); setEditUser(null); },
  });

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>User Management</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => { setForm({ email: '', full_name: '', role: 'contributor', password: '' }); setError(null); setInviteOpen(true); }}>
          Invite User
        </Button>
      </Stack>

      {isLoading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Email</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.full_name || '—'}</TableCell>
                  <TableCell><Chip label={u.role} color={roleColor[u.role]} size="small" /></TableCell>
                  <TableCell><Chip label={u.is_active ? 'Active' : 'Inactive'} color={u.is_active ? 'success' : 'default'} size="small" /></TableCell>
                  <TableCell>{new Date(u.created_at).toLocaleDateString()}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setEditUser(u)}><Edit fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => updateMutation.mutate({ id: u.id, data: { is_active: !u.is_active } })}>
                      <PersonOff fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Invite Team Member</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Email" fullWidth required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <TextField label="Full Name" fullWidth value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            <TextField label="Temporary Password" type="password" fullWidth required value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select label="Role" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="contributor">Contributor</MenuItem>
                <MenuItem value="viewer">Viewer</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating…' : 'Create Account'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit role dialog */}
      <Dialog open={Boolean(editUser)} onClose={() => setEditUser(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit User Role</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">{editUser?.email}</Typography>
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select label="Role" value={editUser?.role || 'contributor'} onChange={e => setEditUser(u => u ? { ...u, role: e.target.value } : null)}>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="contributor">Contributor</MenuItem>
                <MenuItem value="viewer">Viewer</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditUser(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => editUser && updateMutation.mutate({ id: editUser.id, data: { role: editUser.role } })}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
