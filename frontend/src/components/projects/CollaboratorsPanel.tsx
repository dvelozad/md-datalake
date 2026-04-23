import React, { useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, Alert, Stack, Chip,
} from '@mui/material';
import { PersonRemove, PersonAdd } from '@mui/icons-material';
import type { Project } from '@/types/visualization';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  project: Project;
  onAddCollaborator: (userId: number, role: string) => Promise<void>;
  onRemoveCollaborator: (userId: number) => Promise<void>;
}

export const CollaboratorsPanel: React.FC<Props> = ({
  project, onAddCollaborator, onRemoveCollaborator,
}) => {
  const { user, isAdmin } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('viewer');
  const [error, setError] = useState<string | null>(null);

  const canManage = isAdmin || project.created_by_id === user?.id;

  const handleAdd = async () => {
    const id = parseInt(userId);
    if (!id) { setError('Enter a valid user ID.'); return; }
    setError(null);
    try {
      await onAddCollaborator(id, role);
      setAddOpen(false);
      setUserId('');
      setRole('viewer');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to add collaborator.');
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="subtitle1" fontWeight={600}>Collaborators</Typography>
        {canManage && (
          <Button size="small" startIcon={<PersonAdd />} onClick={() => setAddOpen(true)}>
            Add
          </Button>
        )}
      </Stack>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Role</TableCell>
            {canManage && <TableCell align="right" />}
          </TableRow>
        </TableHead>
        <TableBody>
          {project.collaborators.map(c => (
            <TableRow key={c.user_id}>
              <TableCell>{c.full_name || '—'}</TableCell>
              <TableCell>{c.email}</TableCell>
              <TableCell><Chip label={c.role} size="small" /></TableCell>
              {canManage && (
                <TableCell align="right">
                  <IconButton size="small" onClick={() => onRemoveCollaborator(c.user_id)}>
                    <PersonRemove fontSize="small" />
                  </IconButton>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Collaborator</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="User ID"
              type="number"
              fullWidth
              value={userId}
              onChange={e => setUserId(e.target.value)}
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select label="Role" value={role} onChange={e => setRole(e.target.value)}>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="contributor">Contributor</MenuItem>
                <MenuItem value="viewer">Viewer</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAdd}>Add</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
