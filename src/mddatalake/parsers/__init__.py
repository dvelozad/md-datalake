"""Parsers for LAMMPS and GROMACS simulation files."""

from mddatalake.parsers.detector import detect_engine
from mddatalake.parsers.gromacs.parser import GromacsParser
from mddatalake.parsers.lammps.parser import LammpsParser

__all__ = ["detect_engine", "LammpsParser", "GromacsParser"]
