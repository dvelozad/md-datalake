#!/usr/bin/env python3
"""Create minimal test trajectory files for unit testing."""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))


def create_lammps_dump():
    """Create a minimal LAMMPS dump file."""
    dump_content = """ITEM: TIMESTEP
0
ITEM: NUMBER OF ATOMS
32
ITEM: BOX BOUNDS pp pp pp
0.0000000000000000e+00 1.2400000000000000e+01
0.0000000000000000e+00 1.2400000000000000e+01
0.0000000000000000e+00 1.2400000000000000e+01
ITEM: ATOMS id type x y z
1 1 0.5 0.5 0.5
2 1 1.5 0.5 0.5
3 2 2.5 0.5 0.5
4 2 3.5 0.5 0.5
5 1 4.5 0.5 0.5
6 1 5.5 0.5 0.5
7 2 6.5 0.5 0.5
8 2 7.5 0.5 0.5
9 1 0.5 1.5 0.5
10 1 1.5 1.5 0.5
11 2 2.5 1.5 0.5
12 2 3.5 1.5 0.5
13 1 4.5 1.5 0.5
14 1 5.5 1.5 0.5
15 2 6.5 1.5 0.5
16 2 7.5 1.5 0.5
17 1 0.5 2.5 0.5
18 1 1.5 2.5 0.5
19 2 2.5 2.5 0.5
20 2 3.5 2.5 0.5
21 1 4.5 2.5 0.5
22 1 5.5 2.5 0.5
23 2 6.5 2.5 0.5
24 2 7.5 2.5 0.5
25 1 0.5 3.5 0.5
26 1 1.5 3.5 0.5
27 2 2.5 3.5 0.5
28 2 3.5 3.5 0.5
29 1 4.5 3.5 0.5
30 1 5.5 3.5 0.5
31 2 6.5 3.5 0.5
32 2 7.5 3.5 0.5
ITEM: TIMESTEP
1000
ITEM: NUMBER OF ATOMS
32
ITEM: BOX BOUNDS pp pp pp
0.0000000000000000e+00 1.2400000000000000e+01
0.0000000000000000e+00 1.2400000000000000e+01
0.0000000000000000e+00 1.2400000000000000e+01
ITEM: ATOMS id type x y z
1 1 0.6 0.5 0.5
2 1 1.4 0.5 0.5
3 2 2.6 0.5 0.5
4 2 3.4 0.5 0.5
5 1 4.6 0.5 0.5
6 1 5.4 0.5 0.5
7 2 6.6 0.5 0.5
8 2 7.4 0.5 0.5
9 1 0.6 1.5 0.5
10 1 1.4 1.5 0.5
11 2 2.6 1.5 0.5
12 2 3.4 1.5 0.5
13 1 4.6 1.5 0.5
14 1 5.4 1.5 0.5
15 2 6.6 1.5 0.5
16 2 7.4 1.5 0.5
17 1 0.6 2.5 0.5
18 1 1.4 2.5 0.5
19 2 2.6 2.5 0.5
20 2 3.4 2.5 0.5
21 1 4.6 2.5 0.5
22 1 5.4 2.5 0.5
23 2 6.6 2.5 0.5
24 2 7.4 2.5 0.5
25 1 0.6 3.5 0.5
26 1 1.4 3.5 0.5
27 2 2.6 3.5 0.5
28 2 3.4 3.5 0.5
29 1 4.6 3.5 0.5
30 1 5.4 3.5 0.5
31 2 6.6 3.5 0.5
32 2 7.4 3.5 0.5
"""

    output_path = Path(__file__).parent / "lammps" / "water_nvt" / "traj.dump"
    output_path.write_text(dump_content)
    print(f"Created: {output_path}")


def create_gromacs_gro():
    """Create a minimal GROMACS .gro file."""
    gro_content = """Test system
   32
    1SOL     OW    1   0.500   0.500   0.500
    1SOL    HW1    2   0.550   0.500   0.500
    2SOL     OW    3   1.500   0.500   0.500
    2SOL    HW1    4   1.550   0.500   0.500
    3SOL     OW    5   2.500   0.500   0.500
    3SOL    HW1    6   2.550   0.500   0.500
    4SOL     OW    7   3.500   0.500   0.500
    4SOL    HW1    8   3.550   0.500   0.500
    5SOL     OW    9   0.500   1.500   0.500
    5SOL    HW1   10   0.550   1.500   0.500
    6SOL     OW   11   1.500   1.500   0.500
    6SOL    HW1   12   1.550   1.500   0.500
    7SOL     OW   13   2.500   1.500   0.500
    7SOL    HW1   14   2.550   1.500   0.500
    8SOL     OW   15   3.500   1.500   0.500
    8SOL    HW1   16   3.550   1.500   0.500
    9SOL     OW   17   0.500   2.500   0.500
    9SOL    HW1   18   0.550   2.500   0.500
   10SOL     OW   19   1.500   2.500   0.500
   10SOL    HW1   20   1.550   2.500   0.500
   11SOL     OW   21   2.500   2.500   0.500
   11SOL    HW1   22   2.550   2.500   0.500
   12SOL     OW   23   3.500   2.500   0.500
   12SOL    HW1   24   3.550   2.500   0.500
   13SOL     OW   25   0.500   3.500   0.500
   13SOL    HW1   26   0.550   3.500   0.500
   14SOL     OW   27   1.500   3.500   0.500
   14SOL    HW1   28   1.550   3.500   0.500
   15SOL     OW   29   2.500   3.500   0.500
   15SOL    HW1   30   2.550   3.500   0.500
   16SOL     OW   31   3.500   3.500   0.500
   16SOL    HW1   32   3.550   3.500   0.500
   4.00000   4.00000   4.00000
"""

    output_path = Path(__file__).parent / "gromacs" / "lysozyme" / "conf.gro"
    output_path.write_text(gro_content)
    print(f"Created: {output_path}")


if __name__ == "__main__":
    print("Creating test trajectory files...")
    create_lammps_dump()
    create_gromacs_gro()
    print("Done!")
