import React from 'react';
import { Container, Paper, Typography, Box, Divider } from '@mui/material';
import { Info, Storage, Science } from '@mui/icons-material';

export const AboutPage: React.FC = () => {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Info sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
          <Typography variant="h3" gutterBottom>
            About MD Datalake
          </Typography>
          <Typography variant="body1" color="text.secondary">
            A comprehensive platform for molecular dynamics simulation data management
          </Typography>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Storage sx={{ mr: 2, color: 'primary.main' }} />
            <Typography variant="h5">Mission</Typography>
          </Box>
          <Typography variant="body1" paragraph>
            MD Datalake serves as a central research hub for managing, analyzing, and sharing
            molecular dynamics simulation data. Our platform provides unified access to simulation
            trajectories, metadata, and analysis tools, facilitating reproducible computational
            research.
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Science sx={{ mr: 2, color: 'primary.main' }} />
            <Typography variant="h5">Features</Typography>
          </Box>
          <Typography variant="body1" component="div">
            • Upload and store LAMMPS and GROMACS simulation data
            <br />
            • Interactive trajectory visualization
            <br />
            • Advanced filtering and search capabilities
            <br />
            • Observable and property tracking
            <br />
            • Data completeness monitoring
            <br />
            • RESTful API for programmatic access
          </Typography>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Version 1.0 • Built with FastAPI, React, and PostgreSQL
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};
