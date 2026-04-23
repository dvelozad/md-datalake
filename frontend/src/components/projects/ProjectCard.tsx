import React from 'react';
import {
  Card, CardContent, CardActionArea, Typography, Chip, Stack, Box,
  Tooltip,
} from '@mui/material';
import { Lock, LockOpen, Science } from '@mui/icons-material';
import type { Project } from '@/types/visualization';

interface Props {
  project: Project;
  onClick: () => void;
}

export const ProjectCard: React.FC<Props> = ({ project, onClick }) => (
  <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
    <CardActionArea onClick={onClick} sx={{ flex: 1, alignItems: 'flex-start', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ width: '100%' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={0.5}>
          <Typography variant="h6" fontWeight={700} sx={{ flex: 1, mr: 1, lineHeight: 1.2 }}>
            {project.name}
          </Typography>
          <Tooltip title={project.is_public ? 'Public' : 'Private'}>
            {project.is_public
              ? <LockOpen fontSize="small" color="action" />
              : <Lock fontSize="small" color="action" />}
          </Tooltip>
        </Stack>

        {project.pi_name && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            PI: {project.pi_name}
          </Typography>
        )}
        {project.institution && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {project.institution}
          </Typography>
        )}

        {project.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1, mb: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {project.description}
          </Typography>
        )}

        {(project.keywords || []).length > 0 && (
          <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {project.keywords.slice(0, 4).map(kw => (
              <Chip key={kw} label={kw} size="small" variant="outlined" />
            ))}
            {project.keywords.length > 4 && (
              <Chip label={`+${project.keywords.length - 4}`} size="small" variant="outlined" />
            )}
          </Box>
        )}

        <Stack direction="row" alignItems="center" spacing={0.5} mt={1.5}>
          <Science fontSize="small" color="primary" />
          <Typography variant="body2" fontWeight={600}>
            {project.run_count} run{project.run_count !== 1 ? 's' : ''}
          </Typography>
        </Stack>
      </CardContent>
    </CardActionArea>
  </Card>
);
