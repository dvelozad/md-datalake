import React from 'react';
import { Container, Paper, Typography, Box, Grid, Card, CardContent } from '@mui/material';
import { Construction, Timeline, Functions, Assessment } from '@mui/icons-material';

export const ToolsPage: React.FC = () => {
  const tools = [
    {
      title: 'RDF Analysis',
      description: 'Radial distribution function calculations for structural analysis',
      icon: <Timeline />,
    },
    {
      title: 'Energy Analysis',
      description: 'Potential and kinetic energy tracking and visualization',
      icon: <Functions />,
    },
    {
      title: 'Property Calculator',
      description: 'Compute thermodynamic and structural properties',
      icon: <Assessment />,
    },
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Construction sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
          <Typography variant="h3" gutterBottom>
            Analysis Tools
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Coming soon - Tools for advanced trajectory analysis and data processing
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {tools.map((tool, index) => (
            <Grid item xs={12} md={4} key={index}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: 3,
                    transform: 'translateY(-4px)',
                  },
                }}
              >
                <CardContent sx={{ textAlign: 'center', p: 3 }}>
                  <Box sx={{ color: 'primary.main', mb: 2 }}>
                    {React.cloneElement(tool.icon, { sx: { fontSize: 48 } })}
                  </Box>
                  <Typography variant="h6" gutterBottom>
                    {tool.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {tool.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Paper>
    </Container>
  );
};
