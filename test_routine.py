"""Test Routine functionality"""

import sys
import io

# Fix UTF-8 encoding for Windows
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from taskflow.models import RoutineTask
from taskflow.storage import RoutineStorage
from datetime import date

def test_routine_system():
    """Test routine task functionality"""
    print("Testing Routine System")
    print("=" * 50)

    # Create RoutineStorage instance
    storage = RoutineStorage("test_data")
    print("RoutineStorage created")

    # Test 1: Create routine with target value
    routine1 = RoutineTask.create(
        title="Drink water",
        description="Drink 4.5L of water daily",
        target_value=4.5,
        unit="L"
    )
    print(f"✓ Created routine with target: {routine1.target_value} {routine1.unit}")

    # Test 2: Create routine without target
    routine2 = RoutineTask.create(
        title="Read book",
        description="Read for 30 minutes"
    )
    print(f"✓ Created routine without target")

    # Test 3: Add routines to storage
    storage.add_routine(routine1)
    storage.add_routine(routine2)
    print(f"✓ Added 2 routines to storage")

    # Test 4: Load routines
    loaded = storage.load_routines()
    assert len(loaded) == 2
    print(f"✓ Loaded {len(loaded)} routines")

    # Test 5: Check initial status
    assert not loaded[0].is_completed_today
    assert loaded[0].needs_completion
    print(f"✓ Routine needs completion (not completed today)")

    # Test 6: Update progress
    loaded[0].update_progress(2.0)
    assert loaded[0].current_progress == 2.0
    assert not loaded[0].is_completed_today  # Not yet completed
    print(f"✓ Updated progress: {loaded[0].current_progress}/{loaded[0].target_value}")

    # Test 7: Complete routine
    loaded[0].update_progress(2.5)  # Total: 4.5
    assert loaded[0].current_progress == 4.5
    assert loaded[0].is_completed_today  # Should be auto-completed
    print(f"✓ Routine completed: {loaded[0].current_progress}/{loaded[0].target_value}")

    # Test 8: Mark routine as completed
    loaded[1].mark_completed()
    assert loaded[1].is_completed_today
    assert not loaded[1].needs_completion
    print(f"✓ Routine marked as completed")

    # Test 9: Save and reload
    storage.save_routines(loaded)
    reloaded = storage.load_routines()
    assert len(reloaded) == 2
    assert reloaded[0].is_completed_today
    assert reloaded[1].is_completed_today
    print(f"✓ Saved and reloaded routines")

    # Test 10: Progress display
    progress = loaded[0].get_status_display()
    assert "4.5" in progress
    assert "L" in progress
    print(f"✓ Progress display: {progress}")

    # Test 11: Get pending routines
    pending = storage.get_pending_routines()
    assert len(pending) == 0  # Both completed today
    print(f"✓ Pending routines: {len(pending)}")

    # Test 12: Get completed routines
    completed = storage.get_completed_routines()
    assert len(completed) == 2  # Both completed today
    print(f"✓ Completed routines: {len(completed)}")

    # Test 13: Update routine
    loaded[0].title = "Drink more water"
    storage.update_routine(loaded[0])
    updated = storage.get_routine(loaded[0].id)
    assert updated.title == "Drink more water"
    print(f"✓ Updated routine title")

    # Test 14: Delete routine
    storage.delete_routine(loaded[0].id)
    remaining = storage.get_all_routines()
    assert len(remaining) == 1
    print(f"✓ Deleted routine")

    print("\n" + "=" * 50)
    print("All Routine System tests passed! ✓")

    # Cleanup
    import shutil
    import os
    if os.path.exists("test_data"):
        shutil.rmtree("test_data")
        print("✓ Cleanup completed")

if __name__ == "__main__":
    test_routine_system()
