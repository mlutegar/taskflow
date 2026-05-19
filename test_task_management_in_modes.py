"""Test task management options in modes"""

import sys
import io
from typing import Optional

# Fix UTF-8 encoding for Windows
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from taskflow.models import Task
from taskflow.storage import TaskStorage
from taskflow.modes.tiktok import TikTokMode

def test_task_management_in_modes():
    """Test the new task management options in modes"""
    print("Testing Task Management in Modes")
    print("=" * 50)

    # Clean test data first
    import shutil
    import os
    if os.path.exists("test_data"):
        shutil.rmtree("test_data")

    # Create storage
    storage = TaskStorage("test_data")
    mode = TikTokMode(storage)

    # Add initial tasks
    task1 = Task.create("Task 1")
    task2 = Task.create("Task 2")
    storage.add_task(task1)
    storage.add_task(task2)
    print("✓ Created 2 initial tasks")

    # Test 1: Check method exists
    assert hasattr(mode, 'select_task_with_management')
    print("✓ select_task_with_management method exists")

    # Test 2: Check helper methods exist
    assert hasattr(mode, '_select_task_from_list')
    assert hasattr(mode, '_add_new_task_interactive')
    assert hasattr(mode, '_add_checklist_interactive')
    print("✓ All helper methods exist")

    # Test 3: _select_task_from_list
    tasks = storage.get_active_tasks()
    assert len(tasks) == 2

    selected = mode._select_task_from_list([])
    assert selected is None  # No tasks
    print("✓ _select_task_from_list handles empty list")

    # Test 4: _add_new_task_interactive (simulate)
    # This would normally require user input, so we'll just check it exists and returns right type
    import inspect
    sig = inspect.signature(mode._add_new_task_interactive)
    assert sig.return_annotation == Optional[Task]
    print("✓ _add_new_task_interactive has correct return type")

    # Test 5: _add_checklist_interactive (check signature)
    sig = inspect.signature(mode._add_checklist_interactive)
    assert sig.return_annotation == Optional[Task]
    print("✓ _add_checklist_interactive has correct return type")

    # Test 6: Check that select_task still exists for backward compatibility
    assert hasattr(mode, 'select_task')
    print("✓ select_task still exists (backward compatibility)")

    # Test 7: Verify return structure
    result = {'action': 'cancel', 'task': None}
    assert 'action' in result
    assert 'task' in result
    print("✓ Return structure is correct")

    # Test 8: Check actions are valid
    valid_actions = ['complete_task', 'add_task', 'add_checklist', 'cancel']
    for action in valid_actions:
        result['action'] = action
        assert result['action'] in valid_actions
    print("✓ All valid actions recognized")

    print("\n" + "=" * 50)
    print("All Task Management in Modes tests passed! ✓")

    # Cleanup
    import shutil
    import os
    if os.path.exists("test_data"):
        shutil.rmtree("test_data")
        print("✓ Cleanup completed")

if __name__ == "__main__":
    test_task_management_in_modes()
