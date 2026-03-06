"""Data completeness scenario detection for MD simulations.

This module detects and classifies simulation data scenarios based on available
artifacts and metadata, calculating completeness scores and providing warnings
and recommendations.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class DataScenario(str, Enum):
    """Data completeness scenarios."""

    S1_COMPLETE = "S1_complete"
    S2_NO_LOG = "S2_no_log"
    S3_NO_MOLECULE_IDS = "S3_no_molecule_ids"
    S4_TRAJECTORY_ONLY = "S4_trajectory_only"
    S5_NO_TOPOLOGY = "S5_no_topology"
    S6_MINIMAL = "S6_minimal"


@dataclass
class CompletenessInfo:
    """Data completeness information for a simulation run."""

    scenario: DataScenario
    score: int  # 0-100
    missing_data: list[str] = field(default_factory=list)
    quality_flags: dict[str, Any] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)


class ScenarioDetector:
    """Detects data completeness scenarios and calculates quality metrics."""

    # Weights for completeness score calculation (sum to 100)
    WEIGHTS = {
        "trajectory": 40,
        "topology": 20,
        "log_file": 20,
        "input_script": 10,
        "molecule_ids": 5,
        "bonds_angles": 5,
    }

    def detect(self, metadata: dict, artifacts: list[dict]) -> CompletenessInfo:
        """Detect data scenario and calculate completeness.

        Args:
            metadata: Parsed metadata dictionary
            artifacts: List of artifact dictionaries with 'artifact_type' and other fields

        Returns:
            CompletenessInfo with scenario, score, and quality information
        """
        # Check what data is available
        has_trajectory = self._has_artifact_type(artifacts, "trajectory")
        has_topology = self._has_artifact_type(artifacts, "topology")
        has_log = self._has_artifact_type(artifacts, "log")
        has_input = self._has_artifact_type(artifacts, "input")
        has_molecule_ids = metadata.get("has_molecule_ids", False)
        has_bonds_angles = metadata.get("has_bonds_angles", False)

        # Calculate completeness score
        score = 0
        if has_trajectory:
            score += self.WEIGHTS["trajectory"]
        if has_topology:
            score += self.WEIGHTS["topology"]
        if has_log:
            score += self.WEIGHTS["log_file"]
        if has_input:
            score += self.WEIGHTS["input_script"]
        if has_molecule_ids:
            score += self.WEIGHTS["molecule_ids"]
        if has_bonds_angles:
            score += self.WEIGHTS["bonds_angles"]

        # Determine scenario
        scenario = self._classify_scenario(
            has_trajectory, has_topology, has_log, has_input, has_molecule_ids, has_bonds_angles
        )

        # Build missing data list
        missing_data = []
        if not has_trajectory:
            missing_data.append("trajectory")
        if not has_topology:
            missing_data.append("topology")
        if not has_log:
            missing_data.append("log_file")
        if not has_input:
            missing_data.append("input_script")
        if not has_molecule_ids:
            missing_data.append("molecule_ids")
        if not has_bonds_angles:
            missing_data.append("bonds_angles")

        # Build quality flags
        quality_flags = {
            "has_trajectory": has_trajectory,
            "has_topology": has_topology,
            "has_log_file": has_log,
            "has_input_script": has_input,
            "has_molecule_ids": has_molecule_ids,
            "has_bonds_angles": has_bonds_angles,
            "scenario_type": scenario.value,
        }

        # Generate warnings and recommendations
        warnings = self._generate_warnings(
            has_trajectory, has_topology, has_log, has_input, has_molecule_ids, has_bonds_angles
        )
        recommendations = self._generate_recommendations(
            has_trajectory, has_topology, has_log, has_input, has_molecule_ids, has_bonds_angles
        )

        return CompletenessInfo(
            scenario=scenario,
            score=score,
            missing_data=missing_data,
            quality_flags=quality_flags,
            warnings=warnings,
            recommendations=recommendations,
        )

    def _has_artifact_type(self, artifacts: list[dict], artifact_type: str) -> bool:
        """Check if artifacts list contains a specific type."""
        return any(a.get("artifact_type") == artifact_type for a in artifacts)

    def _classify_scenario(
        self,
        has_trajectory: bool,
        has_topology: bool,
        has_log: bool,
        has_input: bool,
        has_molecule_ids: bool,
        has_bonds_angles: bool,
    ) -> DataScenario:
        """Classify the data scenario based on available components."""
        # S1: Complete - everything present
        if all([has_trajectory, has_topology, has_log, has_input, has_molecule_ids, has_bonds_angles]):
            return DataScenario.S1_COMPLETE

        # S2: No log - everything except log file
        if all([has_trajectory, has_topology, has_input, has_molecule_ids, has_bonds_angles]) and not has_log:
            return DataScenario.S2_NO_LOG

        # S3: No molecule IDs - trajectory and topology without molecule tracking
        if has_trajectory and has_topology and not has_molecule_ids:
            return DataScenario.S3_NO_MOLECULE_IDS

        # S4: Trajectory only - just the trajectory file
        if has_trajectory and not has_topology:
            return DataScenario.S4_TRAJECTORY_ONLY

        # S5: No topology - has trajectory but missing topology
        if has_trajectory and not has_topology:
            return DataScenario.S5_NO_TOPOLOGY

        # S6: Minimal - very little data available
        return DataScenario.S6_MINIMAL

    def _generate_warnings(
        self,
        has_trajectory: bool,
        has_topology: bool,
        has_log: bool,
        has_input: bool,
        has_molecule_ids: bool,
        has_bonds_angles: bool,
    ) -> list[str]:
        """Generate warnings based on missing data."""
        warnings = []

        if not has_trajectory:
            warnings.append("No trajectory file found - visualization and analysis not possible")

        if not has_topology:
            warnings.append("No topology file found - structural analysis limited")

        if not has_log:
            warnings.append("No log file found - thermodynamic observables unavailable")

        if not has_input:
            warnings.append("No input script found - simulation parameters may be incomplete")

        if has_trajectory and not has_molecule_ids:
            warnings.append("Trajectory lacks molecule IDs - molecular analysis disabled")

        if has_topology and not has_bonds_angles:
            warnings.append("Topology lacks bond/angle data - connectivity analysis limited")

        return warnings

    def _generate_recommendations(
        self,
        has_trajectory: bool,
        has_topology: bool,
        has_log: bool,
        has_input: bool,
        has_molecule_ids: bool,
        has_bonds_angles: bool,
    ) -> list[str]:
        """Generate recommendations for improving data completeness."""
        recommendations = []

        if not has_trajectory:
            recommendations.append("Upload trajectory file to enable visualization")

        if not has_topology:
            recommendations.append("Upload topology file to enable structural analysis")

        if not has_log:
            recommendations.append("Upload log file to access thermodynamic data")

        if not has_input:
            recommendations.append("Upload input script for complete reproducibility")

        if has_trajectory and not has_molecule_ids:
            recommendations.append("Re-run simulation with molecule ID output enabled")

        if has_topology and not has_bonds_angles:
            recommendations.append("Include bond/angle definitions in topology file")

        return recommendations
