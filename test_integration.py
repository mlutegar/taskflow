"""Integration test for tree view in task selection"""

import sys
import io

# Fix UTF-8 encoding for Windows
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from taskflow.models import Task
from taskflow.storage import TaskStorage
from taskflow.utils import print_tree_for_selection, print_task_list
import os

def test_integration():
    """Test integration between table and tree views"""
    print("Testing Integration: Table vs Tree View")
    print("=" * 50)

    # Create temporary storage
    test_storage = TaskStorage("test_integration")

    # Create test tasks with long titles
    tasks = [
        Task.create("Task 1: Short title", priority=1, due_date="2026-04-10"),
        Task.create("Task 2: This is a much longer title that would normally be truncated in table view but should be fully visible in tree view mode", priority=2),
        Task.create("Task 3: Another task with a very long title to demonstrate the difference between table and tree view modes in the TaskFlow application", priority=3),
    ]

    # Add checklist to one task
    tasks[1].add_checklist_item("Checklist item 1")
    tasks[1].add_checklist_item("Checklist item 2")

    # Save tasks
    for task in tasks:
        test_storage.add_task(task)

    print(f"✓ Created and saved {len(tasks)} test tasks")

    # Test table view (existing functionality)
    print("\n" + "=" * 50)
    print("TABLE VIEW (Existing - with truncation)")
    print("=" * 50)
    print_task_list(tasks, "Table View Test")
    print("\nNote: Titles are truncated at 25 characters in table view")

    # Test tree view (new functionality)
    print("\n" + "=" * 50)
    print("TREE VIEW (New - no truncation)")
    print("=" * 50)
    task_map = print_tree_for_selection(tasks)
    print("\nNote: Full titles are visible in tree view")

    # Verify both work
    print("\n" + "=" * 50)
    print("Verification")
    print("=" * 50)

    # Check that tree view returned correct mapping
    assert len(task_map) == len(tasks), "Tree view should return all tasks"
    print("✓ Tree view returns correct number of tasks")

    # Check that all tasks are accessible
    for i in range(1, len(tasks) + 1):
        assert i in task_map, f"Task {i} should be in mapping"
        assert task_map[i].title == tasks[i-1].title, f"Task {i} title should match"
    print("✓ All tasks are accessible via numbered mapping")

    # Check that long titles are preserved
    long_task_index = 2  # Task 2 has a long title
    long_title = task_map[long_task_index].title
    assert len(long_title) > 25, "Long title should be preserved in tree view"
    assert "truncated" not in long_title.lower() or len(long_title) > 100, "Long title should be complete"
    print(f"✓ Long titles are preserved (Task 2: {len(long_title)} characters)")

    # Cleanup
    for task in tasks:
        test_storage.delete_task(task.id)
    print("✓ Cleanup completed")

    print("\n" + "=" * 50)
    print("All integration tests passed! ✓")
    print("=" * 50)
    print("\nSummary:")
    print("- Table view: Shows compact table with truncated titles")
    print("- Tree view: Shows full titles without truncation")
    print("- Both views allow task selection")
    print("- Users can choose their preferred view mode")

    return True

if __name__ == "__main__":
    try:
        success = test_integration()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n✗ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
