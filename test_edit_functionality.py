"""Test edit functionality for tasks and routines"""

import sys
import io

# Fix UTF-8 encoding for Windows
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from taskflow.models import Task, RoutineTask
from taskflow.storage import TaskStorage, RoutineStorage

def test_edit_task():
    """Test editing a task"""
    print("Testing Edit Task")
    print("=" * 50)

    # Clean up
    import shutil
    import os
    if os.path.exists("test_data"):
        shutil.rmtree("test_data")

    storage = TaskStorage("test_data")

    # Create a task
    task = Task.create("Original Title", "Original Description")
    storage.add_task(task)
    print("✓ Created task with original title and description")

    # Edit title
    task.title = "Updated Title"
    storage.update_task(task)
    print("✓ Updated title")

    # Verify
    updated = storage.get_task(task.id)
    assert updated.title == "Updated Title"
    assert updated.description == "Original Description"
    print(f"✓ Verified: title = {updated.title}")

    # Edit description
    updated.description = "Updated Description"
    storage.update_task(updated)
    print("✓ Updated description")

    # Verify both
    final = storage.get_task(task.id)
    assert final.title == "Updated Title"
    assert final.description == "Updated Description"
    print(f"✓ Verified: title = {final.title}, description = {final.description}")

    print("\n" + "=" * 50)
    print("Edit Task tests passed! ✓")

    # Cleanup
    shutil.rmtree("test_data")
    print("✓ Cleanup completed")


def test_edit_routine():
    """Test editing a routine"""
    print("\nTesting Edit Routine")
    print("=" * 50)

    # Clean up
    import shutil
    import os
    if os.path.exists("test_data"):
        shutil.rmtree("test_data")

    storage = RoutineStorage("test_data")

    # Create a routine
    routine = RoutineTask.create("Drink Water", "Stay hydrated", 4.5, "L")
    storage.add_routine(routine)
    print("✓ Created routine with original values")

    # Edit title
    routine.title = "Drink More Water"
    storage.update_routine(routine)
    print("✓ Updated title")

    # Verify
    updated = storage.get_routine(routine.id)
    assert updated.title == "Drink More Water"
    assert updated.target_value == 4.5
    print(f"✓ Verified: title = {updated.title}, target = {updated.target_value}")

    # Edit target value
    updated.target_value = 3.0
    storage.update_routine(updated)
    print("✓ Updated target value")

    # Verify
    final = storage.get_routine(routine.id)
    assert final.title == "Drink More Water"
    assert final.target_value == 3.0
    assert final.unit == "L"
    print(f"✓ Verified: title = {final.title}, target = {final.target_value}")

    # Remove target value
    final.target_value = None
    final.unit = None
    storage.update_routine(final)
    print("✓ Removed target value")

    # Verify
    no_target = storage.get_routine(final.id)
    assert no_target.target_value is None
    assert no_target.unit is None
    print(f"✓ Verified: target = {no_target.target_value}, unit = {no_target.unit}")

    print("\n" + "=" * 50)
    print("Edit Routine tests passed! ✓")

    # Cleanup
    shutil.rmtree("test_data")
    print("✓ Cleanup completed")


if __name__ == "__main__":
    test_edit_task()
    test_edit_routine()
    print("\n" + "=" * 50)
    print("All Edit functionality tests passed! ✓")
