import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Stack, FormControlLabel, Switch, Alert, Chip, Box,
  Typography,
} from '@mui/material';
import type { Project, ProjectCreate } from '@/types/visualization';

interface Props {
  project: Project | null;
  onClose: () => void;
  onSubmit: (data: Partial<ProjectCreate>) => Promise<any>;
}

export const EditProjectDialog: React.FC<Props> = ({ project, onClose, onSubmit }) => {
  const [form, setForm] = useState<Partial<ProjectCreate>>({});
  const [keywordInput, setKeywordInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name,
        description: project.description || '',
        pi_name: project.pi_name || '',
        institution: project.institution || '',
        grant_number: project.grant_number || '',
        funding_source: project.funding_source || '',
        keywords: project.keywords || [],
        is_public: project.is_public,
      });
    }
  }, [project]);

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (!kw) return;
    setForm(f => ({ ...f, keywords: [...(f.keywords || []), kw] }));
    setKeywordInput('');
  };

  const removeKeyword = (kw: string) => {
    setForm(f => ({ ...f, keywords: (f.keywords || []).filter(k => k !== kw) }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await onSubmit(form);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to update project.');
    } finally {
      setLoading(false);
    }
  };

  const set = (field: keyof ProjectCreate, value: any) =>
    setForm(f => ({ ...f, [field]: value }));

  return (
    <Dialog open={Boolean(project)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Project</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Project Name"
            fullWidth
            required
            value={form.name || ''}
            onChange={e => set('name', e.target.value)}
          />
          <TextField
            label="Description"
            fullWidth
            multiline
            rows={2}
            value={form.description || ''}
            onChange={e => set('description', e.target.value)}
          />
          <TextField
            label="PI / Lead Researcher"
            fullWidth
            value={form.pi_name || ''}
            onChange={e => set('pi_name', e.target.value)}
          />
          <TextField
            label="Institution"
            fullWidth
            value={form.institution || ''}
            onChange={e => set('institution', e.target.value)}
          />
          <Stack direction="row" spacing={1}>
            <TextField
              label="Grant Number"
              fullWidth
              value={form.grant_number || ''}
              onChange={e => set('grant_number', e.target.value)}
            />
            <TextField
              label="Funding Source"
              fullWidth
              value={form.funding_source || ''}
              onChange={e => set('funding_source', e.target.value)}
            />
          </Stack>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                label="Add keyword"
                size="small"
                value={keywordInput}
                onChange={e => setKeywordInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                sx={{ flex: 1 }}
              />
              <Button variant="outlined" size="small" onClick={addKeyword}>Add</Button>
            </Stack>
            {(form.keywords || []).length > 0 && (
              <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(form.keywords || []).map(kw => (
                  <Chip key={kw} label={kw} size="small" onDelete={() => removeKeyword(kw)} />
                ))}
              </Box>
            )}
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={form.is_public || false}
                onChange={e => set('is_public', e.target.checked)}
              />
            }
            label={
              <Stack>
                <Typography variant="body2">Public</Typography>
                <Typography variant="caption" color="text.secondary">
                  Public projects are visible to all users
                </Typography>
              </Stack>
            }
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Saving…' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
