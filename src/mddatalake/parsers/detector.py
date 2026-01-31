"""Engine detection from directory contents."""

from pathlib import Path


def detect_engine(directory: Path | str) -> str:
    """
    Detect MD engine from directory contents.

    Args:
        directory: Directory containing simulation files

    Returns:
        Engine name: "lammps" or "gromacs"

    Raises:
        ValueError: If engine cannot be detected
    """
    directory = Path(directory)

    if not directory.exists() or not directory.is_dir():
        raise ValueError(f"Directory does not exist: {directory}")

    # Check for LAMMPS files
    lammps_indicators = [
        "in.*.lammps",
        "in.*",
        "data.*.lmp",
        "data.*",
        "log.lammps",
        "*.dump",
    ]

    for pattern in lammps_indicators:
        if list(directory.glob(pattern)):
            return "lammps"

    # Check for GROMACS files
    gromacs_indicators = [
        "*.tpr",
        "*.mdp",
        "*.top",
        "*.gro",
        "*.xtc",
        "*.trr",
        "*.edr",
        "md.log",
        "mdout.mdp",
    ]

    for pattern in gromacs_indicators:
        if list(directory.glob(pattern)):
            return "gromacs"

    raise ValueError(f"Cannot detect MD engine in directory: {directory}")
