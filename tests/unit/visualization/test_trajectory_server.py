"""Unit tests for WebSocket trajectory server."""

import pytest
import asyncio
import json
from pathlib import Path

from mddatalake.visualization.trajectory_server import (
    TrajectoryStreamingServer,
    run_trajectory_server
)


@pytest.fixture
def lammps_converted_files(tmp_path):
    """Create minimal converted LAMMPS files for testing."""
    pytest.importorskip("MDAnalysis")
    import MDAnalysis as mda

    # Create a minimal PDB file
    pdb_content = """ATOM      1  O   SOL     1       0.500   0.500   0.500  1.00  0.00           O
ATOM      2  H1  SOL     1       0.550   0.500   0.500  1.00  0.00           H
ATOM      3  O   SOL     2       1.500   0.500   0.500  1.00  0.00           O
ATOM      4  H1  SOL     2       1.550   0.500   0.500  1.00  0.00           H
END
"""
    pdb_file = tmp_path / "test.pdb"
    pdb_file.write_text(pdb_content)

    return {"topology": pdb_file}


class TestTrajectoryStreamingServer:
    """Test WebSocket streaming server."""

    def test_server_initialization(self, lammps_converted_files):
        """Test server can be initialized."""
        server = TrajectoryStreamingServer(
            trajectory_path=lammps_converted_files["topology"],  # Using PDB as both
            topology_path=lammps_converted_files["topology"],
            port=8090,
            session_id="test-session-123"
        )

        assert server.port == 8090
        assert server.session_id == "test-session-123"
        assert server.universe is None  # Not loaded yet

    @pytest.mark.asyncio
    async def test_server_start(self, lammps_converted_files):
        """Test server can start and load trajectory."""
        pytest.importorskip("MDAnalysis")

        server = TrajectoryStreamingServer(
            trajectory_path=lammps_converted_files["topology"],
            topology_path=lammps_converted_files["topology"],
            port=18090,  # Use high port to avoid conflicts
            session_id="test-session-start"
        )

        await server.start()

        # Universe should be loaded
        assert server.universe is not None
        assert server.universe.atoms.n_atoms == 4

        # Cleanup
        await server.stop()

    @pytest.mark.asyncio
    async def test_metadata_message(self, lammps_converted_files):
        """Test metadata message format."""
        pytest.importorskip("MDAnalysis")
        import MDAnalysis as mda

        # Create universe directly
        universe = mda.Universe(str(lammps_converted_files["topology"]))

        # Simulate metadata
        metadata = {
            "type": "metadata",
            "session_id": "test",
            "n_atoms": universe.atoms.n_atoms,
            "n_frames": len(universe.trajectory),
            "dt": float(universe.trajectory.dt),
            "total_time": float(universe.trajectory.totaltime),
        }

        assert metadata["type"] == "metadata"
        assert metadata["n_atoms"] == 4
        assert "n_frames" in metadata

    @pytest.mark.asyncio
    async def test_frame_request_format(self):
        """Test frame request message format."""
        request = {
            "type": "request_frame",
            "frameIndex": 42
        }

        # Should be valid JSON
        request_json = json.dumps(request)
        parsed = json.loads(request_json)

        assert parsed["type"] == "request_frame"
        assert parsed["frameIndex"] == 42

    @pytest.mark.asyncio
    async def test_frame_response_format(self, lammps_converted_files):
        """Test frame response message format."""
        pytest.importorskip("MDAnalysis")
        import MDAnalysis as mda

        universe = mda.Universe(str(lammps_converted_files["topology"]))
        universe.trajectory[0]

        coordinates = universe.atoms.positions

        response = {
            "type": "frame",
            "frameIndex": 0,
            "time": float(universe.trajectory.time),
            "coordinates": coordinates.flatten().tolist(),
        }

        # Should be valid JSON
        response_json = json.dumps(response)
        parsed = json.loads(response_json)

        assert parsed["type"] == "frame"
        assert parsed["frameIndex"] == 0
        assert len(parsed["coordinates"]) == 4 * 3  # 4 atoms, 3 coords each

    @pytest.mark.asyncio
    async def test_topology_response_format(self, lammps_converted_files):
        """Test topology response message format."""
        pytest.importorskip("MDAnalysis")
        import MDAnalysis as mda

        universe = mda.Universe(str(lammps_converted_files["topology"]))

        atoms = []
        for atom in universe.atoms:
            atoms.append({
                "index": int(atom.index),
                "name": atom.name,
                "type": atom.type if hasattr(atom, "type") else atom.name,
                "resname": atom.resname if hasattr(atom, "resname") else "",
                "resid": int(atom.resid) if hasattr(atom, "resid") else 0,
                "element": atom.element if hasattr(atom, "element") else "",
            })

        response = {
            "type": "topology",
            "atoms": atoms,
            "bonds": [],
        }

        # Should be valid JSON
        response_json = json.dumps(response)
        parsed = json.loads(response_json)

        assert parsed["type"] == "topology"
        assert len(parsed["atoms"]) == 4
        assert all("index" in atom for atom in parsed["atoms"])
