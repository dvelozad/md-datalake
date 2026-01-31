#!/usr/bin/env python3
"""Test script for visualization functionality."""

import asyncio
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))


async def test_trajectory_conversion():
    """Test LAMMPS to DCD conversion."""
    from mddatalake.visualization.converters import TrajectoryConverter

    converter = TrajectoryConverter()

    print("Testing trajectory conversion...")

    # Test with mock LAMMPS files (if they exist)
    test_dump = Path("/app/tests/fixtures/lammps/water_nvt/traj.dump")
    test_data = Path("/app/tests/fixtures/lammps/water_nvt/data.water")

    if test_dump.exists() and test_data.exists():
        print(f"✓ Found test files: {test_dump}, {test_data}")

        try:
            # Test metadata extraction
            metadata = await converter.get_trajectory_metadata(
                test_dump, test_data, "LAMMPS"
            )
            print(f"✓ Metadata extracted: {metadata}")

            # Test conversion
            converted_traj, converted_top = await converter.convert_if_needed(
                test_dump, test_data, "LAMMPS"
            )
            print(f"✓ Conversion complete:")
            print(f"  Trajectory: {converted_traj}")
            print(f"  Topology: {converted_top}")

        except Exception as e:
            print(f"✗ Conversion failed: {e}")
            import traceback
            traceback.print_exc()
    else:
        print(f"✗ Test files not found: {test_dump}, {test_data}")


async def test_websocket_server():
    """Test WebSocket streaming server."""
    from mddatalake.visualization.trajectory_server import run_trajectory_server
    from pathlib import Path
    import tempfile

    print("\nTesting WebSocket server...")

    # Create mock trajectory files for testing
    # In real use, these would be actual trajectory files

    try:
        # For now, just check import works
        print("✓ WebSocket server module imported successfully")
        print("  Note: Full server test requires actual trajectory files")

    except Exception as e:
        print(f"✗ Server test failed: {e}")


def test_imports():
    """Test that all required imports work."""
    print("Testing imports...")

    try:
        import MDAnalysis as mda
        print(f"✓ MDAnalysis {mda.__version__}")
    except ImportError:
        print("✗ MDAnalysis not installed")
        print("  Install with: pip install MDAnalysis")

    try:
        import websockets
        print(f"✓ websockets {websockets.__version__}")
    except ImportError:
        print("✗ websockets not installed")
        print("  Install with: pip install websockets")

    try:
        from PIL import Image
        print(f"✓ Pillow (PIL)")
    except ImportError:
        print("✗ Pillow not installed")
        print("  Install with: pip install pillow")

    try:
        import numpy as np
        print(f"✓ numpy {np.__version__}")
    except ImportError:
        print("✗ numpy not installed")
        print("  Install with: pip install numpy")


async def main():
    """Run all tests."""
    print("=" * 60)
    print("MD DataLake - Visualization System Tests")
    print("=" * 60)

    test_imports()
    print()

    await test_trajectory_conversion()
    print()

    await test_websocket_server()
    print()

    print("=" * 60)
    print("Tests complete!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
