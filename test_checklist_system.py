"""Test improved checklist system"""

import sys
import io

# Fix UTF-8 encoding for Windows
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from taskflow.models import Task
from taskflow.storage import TaskStorage
from taskflow.modes.music import MusicMode

def test_checklist_system():
    """Test the improved checklist system"""
    print("Testing Improved Checklist System")
    print("=" * 50)

    # Create storage and mode
    storage = TaskStorage("test_data")
    mode = MusicMode(storage)

    # Create a task with checklist
    task = Task.create("Test Task", "Test task with checklist")
    task.add_checklist_item("First item")
    task.add_checklist_item("Second item")
    task.add_checklist_item("Third item")

    storage.add_task(task)
    print("✓ Created task with 3 checklist items")

    # Test 1: Initial state
    assert not task.completed
    assert task.checklist_progress == (0, 3)
    print(f"✓ Initial state: {task.checklist_progress[0]}/{task.checklist_progress[1]} items")

    # Test 2: Toggle first item
    task.toggle_checklist_item(0)
    assert task.checklist[0].completed == True
    assert task.checklist_progress == (1, 3)
    print(f"✓ Toggled item 1: {task.checklist_progress[0]}/{task.checklist_progress[1]} items")

    # Test 3: Toggle second item
    task.toggle_checklist_item(1)
    assert task.checklist[1].completed == True
    assert task.checklist_progress == (2, 3)
    print(f"✓ Toggled item 2: {task.checklist_progress[0]}/{task.checklist_progress[1]} items")

    # Test 4: Save and reload
    storage.update_task(task)
    reloaded = storage.get_task(task.id)
    assert reloaded.checklist_progress == (2, 3)
    print(f"✓ Saved and reloaded: {reloaded.checklist_progress[0]}/{reloaded.checklist_progress[1]} items")

    # Test 5: Complete third item
    reloaded.toggle_checklist_item(2)
    assert reloaded.checklist_progress == (3, 3)
    print(f"✓ Toggled item 3: {reloaded.checklist_progress[0]}/{reloaded.checklist_progress[1]} items")

    # Test 6: All items completed
    all_done = all(item.completed for item in reloaded.checklist)
    assert all_done == True
    print(f"✓ All items completed: {all_done}")

    # Test 7: Mark task as completed
    reloaded.mark_completed()
    storage.update_task(reloaded)
    print(f"✓ Task marked as completed")

    # Test 8: Verify persistence
    final_reload = storage.get_task(task.id)
    assert final_reload.completed == True
    assert final_reload.checklist_progress == (3, 3)
    print(f"✓ Final state: completed={final_reload.completed}, checklist={final_reload.checklist_progress[0]}/{final_reload.checklist_progress[1]}")

    # Test 9: Test _manage_checklist method exists
    assert hasattr(mode, '_manage_checklist')
    print(f"✓ _manage_checklist method exists")

    # Test 10: Test complete_task method exists
    assert hasattr(mode, 'complete_task')
    print(f"✓ complete_task method exists")

    print("\n" + "=" * 50)
    print("All Checklist System tests passed! ✓")

    # Cleanup
    import shutil
    import os
    if os.path.exists("test_data"):
        shutil.rmtree("test_data")
        print("✓ Cleanup completed")

if __name__ == "__main__":
    test_checklist_system()
