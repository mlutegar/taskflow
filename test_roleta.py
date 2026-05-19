"""Test roulette items management"""

import sys
import io

# Fix UTF-8 encoding for Windows
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from taskflow.modes.roleta import RoletaMode
from taskflow.storage import TaskStorage

def test_roleta_items():
    """Test roulette items management"""
    print("Testing Roulette Items Management")
    print("=" * 50)

    # Create RoletaMode instance
    storage = TaskStorage("test_data")
    mode = RoletaMode(storage)

    # Show initial items
    print(f"\n✓ Loaded {len(mode.roleta_items)} default items")

    # Test adding item
    original_count = len(mode.roleta_items)
    mode.roleta_items.append("Test Activity")
    mode._save_roleta_items(mode.roleta_items)
    print(f"✓ Added 'Test Activity'")

    # Reload and verify
    mode2 = RoletaMode(storage)
    assert len(mode2.roleta_items) == original_count + 1
    print(f"✓ Verified: {len(mode2.roleta_items)} items after reload")

    # Test removing item
    mode2.roleta_items.pop()
    mode2._save_roleta_items(mode2.roleta_items)
    print(f"✓ Removed last item")

    # Final verification
    mode3 = RoletaMode(storage)
    assert len(mode3.roleta_items) == original_count
    print(f"✓ Verified: {len(mode3.roleta_items)} items after removal")

    # Test spin functionality
    activities = mode3.spin_roleta(3)
    assert len(activities) == 3
    assert all(isinstance(a, str) for a in activities)
    print(f"✓ Spin test successful: {activities}")

    print("\n" + "=" * 50)
    print("All roulette tests passed! ✓")

    # Cleanup
    import shutil
    import os
    if os.path.exists("test_data"):
        shutil.rmtree("test_data")
        print("✓ Cleanup completed")

if __name__ == "__main__":
    test_roleta_items()
