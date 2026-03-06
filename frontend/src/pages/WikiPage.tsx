import React from 'react';
import { Container, Paper, Typography, Box, Grid, Card, CardContent, Link } from '@mui/material';
import { MenuBook, Description, Code, School } from '@mui/icons-material';

export const WikiPage: React.FC = () => {
  const sections = [
    {
      title: 'User Guide',
      description: 'Learn how to upload, browse, and analyze simulation data',
      icon: <School />,
    },
    {
      title: 'API Documentation',
      description: 'REST API reference for programmatic access',
      icon: <Code />,
    },
    {
      title: 'Data Formats',
      description: 'Supported file formats and data schema documentation',
      icon: <Description />,
    },
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <MenuBook sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
          <Typography variant="h3" gutterBottom>
            Documentation & Wiki
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Comprehensive guides and reference materials for the MD Datalake platform
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {sections.map((section, index) => (
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
                    {React.cloneElement(section.icon, { sx: { fontSize: 48 } })}
                  </Box>
                  <Typography variant="h6" gutterBottom>
                    {section.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {section.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Box sx={{ mt: 4, p: 3, bgcolor: 'background.default', borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>
            Quick Links
          </Typography>
          <Typography variant="body2" component="div">
            • <Link href="#" underline="hover">Getting Started Tutorial</Link>
            <br />
            • <Link href="#" underline="hover">LAMMPS Data Format Specifications</Link>
            <br />
            • <Link href="#" underline="hover">GROMACS Integration Guide</Link>
            <br />
            • <Link href="#" underline="hover">Frequently Asked Questions</Link>
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};
