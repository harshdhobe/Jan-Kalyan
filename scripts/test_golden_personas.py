"""
Convenience entry point to run the Step 4 golden persona tests:
python scripts/test_golden_personas.py
"""
import sys
from pathlib import Path

# Add repo root to path
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from packages.engine.tests.golden_personas import run_tests

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
