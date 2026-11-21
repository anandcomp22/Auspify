"""Run all test suites for the Auspify Atelier Commerce Engine."""
import sys
import unittest
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import the test module
from tests import test_ecommerce

if __name__ == "__main__":
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromModule(test_ecommerce)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
