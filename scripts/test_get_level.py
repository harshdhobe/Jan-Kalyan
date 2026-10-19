import unittest

def get_level(scheme):
    if not scheme:
        return "unknown"
    s = scheme.get("state")
    if isinstance(s, str):
        trimmed = s.strip()
        if trimmed.lower() == "central":
            return "central"
        if len(trimmed) > 0:
            return "state"
    lvl = scheme.get("level")
    if isinstance(lvl, str):
        lvl_trimmed = lvl.strip().lower()
        if lvl_trimmed == "central":
            return "central"
        if lvl_trimmed == "state":
            return "state"
    return "unknown"

class TestGetLevel(unittest.TestCase):
    def test_central(self):
        self.assertEqual(get_level({"state": "Central"}), "central")
        self.assertEqual(get_level({"state": "central"}), "central")
        self.assertEqual(get_level({"state": "Central "}), "central")

    def test_state(self):
        self.assertEqual(get_level({"state": "Maharashtra"}), "state")
        self.assertEqual(get_level({"state": "Puducherry"}), "state")
        self.assertEqual(get_level({"state": "Uttar Pradesh"}), "state")

    def test_empty_or_unknown(self):
        self.assertEqual(get_level({"state": ""}), "unknown")
        self.assertEqual(get_level({"state": "   "}), "unknown")
        self.assertEqual(get_level({"state": None}), "unknown")
        self.assertEqual(get_level({}), "unknown")
        self.assertEqual(get_level(None), "unknown")

    def test_level_fallback(self):
        self.assertEqual(get_level({"state": None, "level": "central"}), "central")
        self.assertEqual(get_level({"state": None, "level": "state"}), "state")

if __name__ == "__main__":
    unittest.main()
