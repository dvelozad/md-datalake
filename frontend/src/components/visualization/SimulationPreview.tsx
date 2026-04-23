import React, { useEffect, useRef, useState } from 'react';
import { Stage } from 'ngl';
import { Box, CircularProgress, Typography, Alert, Button, Chip } from '@mui/material';
import {
    CenterFocusStrong as CenterIcon,
    RestartAlt as ResetIcon,
    Science as AtomIcon
} from '@mui/icons-material';

interface SimulationPreviewProps {
    runId: number;
    height?: number | string;
    totalTime?: number; // in nanoseconds
}

export const SimulationPreview: React.FC<SimulationPreviewProps> = ({
    runId,
    height = 400,
    totalTime
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<Stage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string>('Initializing...');
    const [atomCount, setAtomCount] = useState<number>(0);
    const [representation, setRepresentation] = useState<string>('ball+stick');

    // Initialize NGL Stage and Load Preview
    useEffect(() => {
        let mounted = true;
        let retryCount = 0;
        const MAX_RETRIES = 10;

        const initialize = async () => {
            if (!containerRef.current) {
                console.log('Container ref not ready');
                return;
            }

            // Initialize stage if not already created
            if (!stageRef.current) {
                console.log('Initializing NGL Stage...');
                try {
                    stageRef.current = new Stage(containerRef.current, {
                        backgroundColor: '#1a1a1a',
                        tooltip: true,
                    });

                    console.log('NGL Stage initialized successfully');
                    console.log('Stage dimensions:', {
                        width: containerRef.current.clientWidth,
                        height: containerRef.current.clientHeight
                    });

                    // Handle resize
                    const handleResize = () => {
                        if (stageRef.current) {
                            stageRef.current.handleResize();
                        }
                    };
                    window.addEventListener('resize', handleResize);

                } catch (error) {
                    console.error('Failed to initialize NGL Stage:', error);
                    if (mounted) {
                        setError('Failed to initialize 3D viewer');
                    }
                    return;
                }
            }

            // Load preview
            try {
                if (!mounted) return;
                setLoading(true);
                setStatus('Requesting preview...');

                const fetchPreview = async (): Promise<Blob | null> => {
                    const token = localStorage.getItem('mddatalake_token');
                    const response = await fetch(`/api/v1/visualizations/runs/${runId}/preview`, {
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                    });

                    if (response.status === 202) {
                        if (retryCount < MAX_RETRIES) {
                            if (mounted) {
                                setStatus(`Generating preview... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
                            }
                            retryCount++;
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            return fetchPreview();
                        } else {
                            throw new Error('Preview generation timed out');
                        }
                    }

                    if (!response.ok) {
                        if (response.status === 404) throw new Error('No trajectory found');
                        throw new Error(`Failed to load preview (${response.status})`);
                    }

                    return response.blob();
                };

                const blob = await fetchPreview();
                if (!blob || !mounted || !stageRef.current) {
                    console.log('Blob fetch failed or component unmounted');
                    return;
                }

                console.log('PDB blob received, size:', blob.size, 'bytes');

                if (mounted) {
                    setStatus('Rendering...');
                }

                // Clear existing components
                stageRef.current.removeAllComponents();
                console.log('Existing components cleared');

                // Load blob
                console.log('Loading PDB file into NGL...');
                const component = await stageRef.current.loadFile(blob, {
                    ext: 'pdb',
                    defaultRepresentation: false
                }) as any;

                console.log('Component loaded:', component);

                if (!component || !component.structure) {
                    console.error('Component or structure is null/undefined');
                    throw new Error('Failed to load structure');
                }

                const atomCount = component.structure.atomCount || 0;
                console.log('Structure loaded with', atomCount, 'atoms');

                if (atomCount === 0) {
                    throw new Error('Preview contains no atoms');
                }

                console.log(`Successfully loaded ${atomCount} atoms from preview`);

                // Choose representation based on atom count
                let repType = '';
                if (atomCount > 50000) {
                    repType = 'point';
                    console.log('Adding point representation for', atomCount, 'atoms');
                    component.addRepresentation('point', {
                        sele: 'all',
                        colorScheme: 'element',
                        pointSize: 3
                    });
                } else if (atomCount > 10000) {
                    repType = 'line';
                    console.log('Adding line representation for', atomCount, 'atoms');
                    component.addRepresentation('line', {
                        sele: 'all',
                        colorScheme: 'element',
                        opacity: 0.8
                    });
                } else {
                    repType = 'ball+stick';
                    console.log('Adding ball+stick representation for', atomCount, 'atoms');
                    component.addRepresentation('ball+stick', {
                        sele: 'all',
                        colorScheme: 'element'
                    });
                }

                console.log('Representation added:', repType);
                console.log('Component representations count:', component.reprList.length);

                // Auto-center the view
                console.log('Calling autoView...');
                component.autoView();
                console.log('AutoView completed');

                // Force a resize to ensure proper rendering
                console.log('Forcing resize...');
                stageRef.current.handleResize();
                console.log('Resize completed');

                // Force a render
                console.log('Forcing render...');
                stageRef.current.viewer.requestRender();
                console.log('Render requested');

                // Log camera position
                console.log('Camera position:', stageRef.current.viewer.camera.position);
                console.log('Stage has', stageRef.current.compList.length, 'components');

                if (mounted) {
                    setAtomCount(atomCount);

                    // Set initial representation state based on atom count
                    if (atomCount > 50000) {
                        setRepresentation('point');
                    } else if (atomCount > 10000) {
                        setRepresentation('line');
                    } else {
                        setRepresentation('ball+stick');
                    }

                    setLoading(false);
                }

            } catch (err) {
                if (mounted) {
                    console.error('Preview error:', err);
                    setError(err instanceof Error ? err.message : 'Failed to load preview');
                    setLoading(false);
                }
            }
        };

        initialize();

        return () => {
            mounted = false;
            // Don't dispose the stage here - let it persist
            // This prevents React Strict Mode from breaking the visualization
        };
    }, [runId]);

    // Handle representation change
    const changeRepresentation = (type: string) => {
        if (!stageRef.current) return;

        console.log('Changing representation to:', type);
        setRepresentation(type);
        stageRef.current.eachComponent((comp) => {
            comp.removeAllRepresentations();

            // Add representation with appropriate parameters
            const params: any = {
                sele: 'all',
                colorScheme: 'element'
            };

            if (type === 'point') {
                params.pointSize = 3;  // Increased to match initial load
            } else if (type === 'line') {
                params.opacity = 0.8;
            }

            comp.addRepresentation(type, params);
            console.log('Representation changed to', type);
        });

        // Force render after representation change
        stageRef.current.viewer.requestRender();
    };

    const resetView = () => stageRef.current?.autoView();

    return (
        <Box
            sx={{
                height,
                width: '100%',
                position: 'relative',
                bgcolor: '#000',
                borderRadius: 1,
                overflow: 'hidden',
                border: '1px solid #333'
            }}
        >
            {/* Viewport */}
            <div
                ref={containerRef}
                style={{ width: '100%', height: '100%' }}
            />

            {/* Loading Overlay */}
            {loading && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'rgba(0,0,0,0.8)',
                        zIndex: 10,
                        color: 'white'
                    }}
                >
                    <CircularProgress color="primary" />
                    <Typography sx={{ mt: 2 }} variant="body2">{status}</Typography>
                </Box>
            )}

            {/* Error Overlay */}
            {error && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'rgba(0,0,0,0.9)',
                        zIndex: 10,
                        p: 3
                    }}
                >
                    <Alert severity="error" variant="filled">
                        {error}
                    </Alert>
                </Box>
            )}

            {/* Controls Overlay */}
            {!loading && !error && (
                <>
                    {/* Top Info Bar */}
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 10,
                            left: 10,
                            right: 10,
                            display: 'flex',
                            justifyContent: 'space-between',
                            pointerEvents: 'none',
                            gap: 1,
                        }}
                    >
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Chip
                                icon={<AtomIcon style={{ color: 'white' }} />}
                                label={`${atomCount.toLocaleString()} atoms`}
                                size="small"
                                sx={{ bgcolor: 'rgba(0,0,0,0.6)', color: 'white', backdropFilter: 'blur(4px)' }}
                            />
                            {totalTime !== undefined && totalTime > 0 && (
                                <Chip
                                    label={totalTime < 1 ? `${(totalTime * 1000).toFixed(0)} ps` : `${totalTime.toFixed(1)} ns`}
                                    size="small"
                                    sx={{ bgcolor: 'rgba(0,0,0,0.6)', color: 'white', backdropFilter: 'blur(4px)' }}
                                />
                            )}
                        </Box>
                        <Chip
                            label="Preview Mode"
                            size="small"
                            color="primary"
                            sx={{ opacity: 0.9 }}
                        />
                    </Box>

                    {/* Bottom Controls */}
                    <Box
                        sx={{
                            position: 'absolute',
                            bottom: 10,
                            left: 10,
                            right: 10,
                            display: 'flex',
                            gap: 1,
                            justifyContent: 'center',
                            bgcolor: 'rgba(0,0,0,0.6)',
                            p: 1,
                            borderRadius: 4,
                            backdropFilter: 'blur(4px)'
                        }}
                    >
                        {atomCount > 10000 && (
                            <>
                                <Button
                                    size="small"
                                    variant={representation === 'point' ? 'contained' : 'text'}
                                    onClick={() => changeRepresentation('point')}
                                    sx={{ color: 'white', minWidth: 'auto', px: 1, fontSize: '0.75rem' }}
                                >
                                    Point
                                </Button>
                                <Button
                                    size="small"
                                    variant={representation === 'line' ? 'contained' : 'text'}
                                    onClick={() => changeRepresentation('line')}
                                    sx={{ color: 'white', minWidth: 'auto', px: 1, fontSize: '0.75rem' }}
                                >
                                    Line
                                </Button>
                            </>
                        )}
                        {atomCount <= 10000 && (
                            <Button
                                size="small"
                                variant={representation === 'ball+stick' ? 'contained' : 'text'}
                                onClick={() => changeRepresentation('ball+stick')}
                                sx={{ color: 'white', minWidth: 'auto', px: 1, fontSize: '0.75rem' }}
                            >
                                Ball+Stick
                            </Button>
                        )}
                        <Button
                            size="small"
                            variant={representation === 'spacefill' ? 'contained' : 'text'}
                            onClick={() => changeRepresentation('spacefill')}
                            sx={{ color: 'white', minWidth: 'auto', px: 1, fontSize: '0.75rem' }}
                        >
                            Spacefill
                        </Button>
                        <Button
                            size="small"
                            variant={representation === 'licorice' ? 'contained' : 'text'}
                            onClick={() => changeRepresentation('licorice')}
                            sx={{ color: 'white', minWidth: 'auto', px: 1, fontSize: '0.75rem' }}
                        >
                            Licorice
                        </Button>

                        <Box sx={{ width: 1, bgcolor: 'rgba(255,255,255,0.2)', mx: 1 }} />

                        <Button
                            size="small"
                            onClick={resetView}
                            sx={{ color: 'white', minWidth: 'auto' }}
                            startIcon={<ResetIcon />}
                        >
                            Reset
                        </Button>
                        <Button
                            size="small"
                            onClick={() => {
                                if (stageRef.current) {
                                    stageRef.current.autoView();
                                }
                            }}
                            sx={{ color: 'white', minWidth: 'auto' }}
                            startIcon={<CenterIcon />}
                        >
                            Center
                        </Button>
                    </Box>
                </>
            )}
        </Box>
    );
};
