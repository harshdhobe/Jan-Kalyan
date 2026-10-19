import unittest

def get_scope(scheme):
    if not scheme:
        return "unknown"
    s = scheme.get("scope")
    if isinstance(s, str):
        trimmed = s.strip().lower()
        if trimmed in ("individual", "person"):
            return "individual"
        if trimmed == "household":
            return "household"
    return "unknown"

class TestGetScope(unittest.TestCase):
    def test_individual(self):
        self.assertEqual(get_scope({"scope": "person"}), "individual")
        self.assertEqual(get_scope({"scope": "Person"}), "individual")
        self.assertEqual(get_scope({"scope": "individual"}), "individual")
        self.assertEqual(get_scope({"scope": "Individual"}), "individual")

    def test_household(self):
        self.assertEqual(get_scope({"scope": "household"}), "household")
        self.assertEqual(get_scope({"scope": "Household"}), "household")

    def test_empty_or_unknown(self):
        self.assertEqual(get_scope({"scope": ""}), "unknown")
        self.assertEqual(get_scope({"scope": "   "}), "unknown")
        self.assertEqual(get_scope({"scope": None}), "unknown")
        self.assertEqual(get_scope({}), "unknown")
        self.assertEqual(get_scope(None), "unknown")

if __name__ == "__main__":
    unittest.main()
