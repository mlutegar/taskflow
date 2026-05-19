"""Basic test to validate TaskFlow core functionality"""

import sys
import io

# Fix UTF-8 encoding for Windows
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from taskflow.models import Task, ChecklistItem
from taskflow.storage import TaskStorage
import os

def test_basic_functionality():
    """Test basic CRUD operations"""
    print("Testing TaskFlow Core Functionality")
    print("=" * 50)

    # Create storage
    storage = TaskStorage("test_data")
    print("✓ Storage created")

    # Create a task
    task1 = Task.create(
        title="Test Task",
        description="This is a test task"
    )
    print("✓ Task created")

    # Add checklist items
    task1.add_checklist_item("First item")
    task1.add_checklist_item("Second item")
    print(f"✓ Added {len(task1.checklist)} checklist items")

    # Save task
    storage.add_task(task1)
    print("✓ Task saved")

    # Load tasks
    loaded_tasks = storage.load_tasks()
    print(f"✓ Loaded {len(loaded_tasks)} task(s)")

    # Verify task data
    loaded_task = loaded_tasks[0]
    assert loaded_task.title == "Test Task"
    assert loaded_task.description == "This is a test task"
    assert len(loaded_task.checklist) == 2
    print("✓ Task data verified")

    # Mark checklist item as completed
    loaded_task.toggle_checklist_item(0)
    assert loaded_task.checklist[0].completed == True
    print("✓ Checklist item toggled")

    # Update task
    storage.update_task(loaded_task)
    print("✓ Task updated")

    # Complete task
    loaded_task.mark_completed()
    storage.update_task(loaded_task)
    print("✓ Task marked as completed")

    # Get active tasks (should be 0)
    active_tasks = storage.get_active_tasks()
    assert len(active_tasks) == 0
    print("✓ Active tasks: 0")

    # Get completed tasks (should be 1)
    completed_tasks = storage.get_completed_tasks()
    assert len(completed_tasks) == 1
    print("✓ Completed tasks: 1")

    # Delete task
    storage.delete_task(loaded_task.id)
    print("✓ Task deleted")

    # Verify deletion
    tasks_after_delete = storage.load_tasks()
    assert len(tasks_after_delete) == 0
    print("✓ Deletion verified")

    print("\n" + "=" * 50)
    print("All tests passed! ✓")

    # Cleanup
    import shutil
    if os.path.exists("test_data"):
        shutil.rmtree("test_data")
        print("✓ Cleanup completed")

if __name__ == "__main__":
    test_basic_functionality()
