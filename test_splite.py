"""Test Splite Mode functionality"""

import sys
import io

# Fix UTF-8 encoding for Windows
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from taskflow.modes.splite import SpliteMode
from taskflow.storage import TaskStorage

def test_splite_mode():
    """Test Splite Mode functionality"""
    print("Testing Splite Mode")
    print("=" * 50)

    # Create SpliteMode instance
    storage = TaskStorage("test_data")
    mode = SpliteMode(storage)

    # Test loading default activities
    print(f"✓ Loaded {len(mode.activities)} default activities")
    assert len(mode.activities) == 13
    print(f"✓ Activities: {', '.join(mode.activities[:3])}...")

    # Test adding activity
    original_count = len(mode.activities)
    mode.activities.append("Nova Atividade")
    mode._save_activities(mode.activities)
    print(f"✓ Added 'Nova Atividade'")

    # Reload and verify
    mode2 = SpliteMode(storage)
    assert len(mode2.activities) == original_count + 1
    assert "Nova Atividade" in mode2.activities
    print(f"✓ Verified: {len(mode2.activities)} activities after reload")

    # Test removing activity
    mode2.activities.remove("Nova Atividade")
    mode2._save_activities(mode2.activities)
    print(f"✓ Removed 'Nova Atividade'")

    # Final verification
    mode3 = SpliteMode(storage)
    assert len(mode3.activities) == original_count
    assert "Nova Atividade" not in mode3.activities
    print(f"✓ Verified: {len(mode3.activities)} activities after removal")

    # Test specific activities exist
    assert "Ler diário" in mode3.activities
    assert "Jogar Spelunky" in mode3.activities
    assert "Meditar" in mode3.activities
    print(f"✓ Verified default activities exist")

    print("\n" + "=" * 50)
    print("All Splite Mode tests passed! ✓")

    # Cleanup
    import shutil
    import os
    if os.path.exists("test_data"):
        shutil.rmtree("test_data")
        print("✓ Cleanup completed")

if __name__ == "__main__":
    test_splite_mode()
