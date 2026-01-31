"""Unit tests for visualization session manager."""

import pytest
from pathlib import Path
import tempfile

from mddatalake.visualization.mdserv_manager import MDservManager


@pytest.fixture
def manager():
    """Create session manager with temp directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield MDservManager(
            port_range_start=28090,
            port_range_end=28190,
            session_timeout_seconds=3600,
            temp_dir=Path(tmpdir)
        )


class TestMDservManager:
    """Test session manager."""

    def test_initialization(self, manager):
        """Test manager initializes correctly."""
        assert manager.port_range_start == 28090
        assert manager.port_range_end == 28190
        assert manager.session_timeout_seconds == 3600
        assert manager.temp_dir.exists()

    def test_port_allocation(self, manager):
        """Test port allocation."""
        port1 = manager._find_available_port()
        assert 28090 <= port1 < 28190

        # Port should be marked as used
        assert port1 in manager._used_ports

        # Second allocation should give different port
        port2 = manager._find_available_port()
        assert port2 != port1

    def test_port_allocation_exhaustion(self):
        """Test behavior when all ports are used."""
        # Create manager with very small port range
        with tempfile.TemporaryDirectory() as tmpdir:
            small_manager = MDservManager(
                port_range_start=28090,
                port_range_end=28092,  # Only 2 ports
                temp_dir=Path(tmpdir)
            )

            # Allocate all ports
            port1 = small_manager._find_available_port()
            port2 = small_manager._find_available_port()

            # Third allocation should raise error
            with pytest.raises(RuntimeError, match="No available ports"):
                small_manager._find_available_port()

    def test_checksum_computation(self, manager, tmp_path):
        """Test checksum computation."""
        # Create test file
        test_file = tmp_path / "test.txt"
        test_file.write_text("test content")

        checksum = manager.converter._compute_checksum(test_file)

        # Should be 16-character hex string
        assert len(checksum) == 16
        assert all(c in "0123456789abcdef" for c in checksum)

    def test_server_tracking(self, manager):
        """Test server tracking dictionary."""
        assert len(manager.servers) == 0

        # Add mock server
        manager.servers["test-session-1"] = "mock-server-1"
        assert len(manager.servers) == 1
        assert "test-session-1" in manager.servers

        # Remove server
        del manager.servers["test-session-1"]
        assert len(manager.servers) == 0

    def test_port_release(self, manager):
        """Test port release after allocation."""
        port = manager._find_available_port()
        assert port in manager._used_ports

        # Release port
        manager._used_ports.remove(port)
        assert port not in manager._used_ports

        # Should be able to allocate again
        port2 = manager._find_available_port()
        # Might get same port back
        assert port2 in manager._used_ports
