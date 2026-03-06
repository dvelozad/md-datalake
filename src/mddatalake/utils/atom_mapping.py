"""Utilities for handling LAMMPS atom type mappings."""

import json
from pathlib import Path
from typing import Any


class AtomTypeMappingError(Exception):
    """Exception raised for errors in atom type mapping files."""
    pass


def parse_atom_type_mapping(file_path: Path) -> dict[str, Any]:
    """
    Parse atom type mapping file (JSON format).

    Expected format:
    {
      "description": "System description",
      "mappings": {
        "1": {
          "element": "N",
          "name": "NA",
          "description": "Nitrogen atom",
          "residue": "MOL",
          "color": "#0000FF"  // optional
        },
        ...
      }
    }

    Args:
        file_path: Path to atom type mapping JSON file

    Returns:
        Dictionary with validated mapping data

    Raises:
        AtomTypeMappingError: If file is invalid or missing required fields
    """
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise AtomTypeMappingError(f"Invalid JSON format: {e}")
    except Exception as e:
        raise AtomTypeMappingError(f"Failed to read file: {e}")

    # Validate structure
    if not isinstance(data, dict):
        raise AtomTypeMappingError("Root must be a JSON object")

    if 'mappings' not in data:
        raise AtomTypeMappingError("Missing required 'mappings' field")

    mappings = data['mappings']
    if not isinstance(mappings, dict):
        raise AtomTypeMappingError("'mappings' must be an object")

    # Validate each mapping entry
    for atom_type, mapping in mappings.items():
        if not isinstance(mapping, dict):
            raise AtomTypeMappingError(f"Mapping for type '{atom_type}' must be an object")

        # Check required fields
        if 'element' not in mapping:
            raise AtomTypeMappingError(f"Missing 'element' for atom type '{atom_type}'")

        if 'name' not in mapping:
            raise AtomTypeMappingError(f"Missing 'name' for atom type '{atom_type}'")

        # Validate element is a valid chemical symbol (1-2 letters)
        element = mapping['element']
        if not isinstance(element, str) or len(element) == 0 or len(element) > 2:
            raise AtomTypeMappingError(
                f"Invalid element '{element}' for atom type '{atom_type}'. "
                "Must be 1-2 character chemical symbol."
            )

        # Validate name
        name = mapping['name']
        if not isinstance(name, str) or len(name) == 0:
            raise AtomTypeMappingError(f"Invalid name for atom type '{atom_type}'")

    return data


def apply_atom_type_mapping(
    universe,
    atom_types: list[str],
    mapping: dict[str, Any]
) -> None:
    """
    Apply atom type mapping to MDAnalysis Universe.

    Args:
        universe: MDAnalysis Universe object
        atom_types: List of atom type strings (e.g., ["1", "2", "1", ...])
        mapping: Parsed atom type mapping dictionary

    Raises:
        AtomTypeMappingError: If mapping cannot be applied
    """
    import numpy as np

    if 'mappings' not in mapping:
        raise AtomTypeMappingError("Invalid mapping structure")

    type_map = mapping['mappings']

    # Build arrays for elements and names
    elements = []
    names = []
    resnames = []

    for atom_type in atom_types:
        if atom_type not in type_map:
            # Use mass-based guessing as fallback
            raise AtomTypeMappingError(
                f"Atom type '{atom_type}' not found in mapping. "
                f"Available types: {sorted(type_map.keys())}"
            )

        entry = type_map[atom_type]
        elements.append(entry['element'])
        names.append(entry['name'])
        resnames.append(entry.get('residue', 'UNK'))

    # Apply to universe
    universe.add_TopologyAttr('elements', np.array(elements, dtype=object))
    universe.add_TopologyAttr('names', np.array(names, dtype=object))
    universe.add_TopologyAttr('resnames', np.array(resnames, dtype=object))


def get_atom_type_summary(mapping: dict[str, Any]) -> dict[str, Any]:
    """
    Get summary statistics of atom type mapping.

    Args:
        mapping: Parsed atom type mapping dictionary

    Returns:
        Summary dictionary with counts and element distribution
    """
    if 'mappings' not in mapping:
        return {}

    type_map = mapping['mappings']

    element_counts = {}
    residue_counts = {}

    for atom_type, entry in type_map.items():
        element = entry['element']
        residue = entry.get('residue', 'UNK')

        element_counts[element] = element_counts.get(element, 0) + 1
        residue_counts[residue] = residue_counts.get(residue, 0) + 1

    return {
        'total_types': len(type_map),
        'elements': element_counts,
        'residues': residue_counts,
        'description': mapping.get('description', 'No description'),
    }
