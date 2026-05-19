"""Test tree selection functionality"""

import sys
import io

# Fix UTF-8 encoding for Windows
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from taskflow.models import Task
from taskflow.utils import print_tree_for_selection

def test_tree_selection():
    """Test tree selection function"""
    print("Testing Tree Selection Function")
    print("=" * 50)

    # Create test tasks with varying title lengths
    tasks = [
        Task.create("Short task", priority=1),
        Task.create("Medium length task title", priority=2),
        Task.create("This is a very long task title that should not be truncated in tree view mode", priority=3),
        Task.create("Another task with description", description="With description", priority=4),
    ]

    # Add checklist to one task
    tasks[0].add_checklist_item("First item")
    tasks[0].add_checklist_item("Second item")

    print(f"✓ Created {len(tasks)} test tasks")

    # Test tree selection function
    print("\nTesting tree selection function:")
    print("-" * 50)

    try:
        task_map = print_tree_for_selection(tasks)
        print(f"\n✓ Tree selection function executed successfully")
        print(f"✓ Returned mapping with {len(task_map)} tasks")

        # Verify mapping
        assert len(task_map) == len(tasks), "Mapping should have same number of tasks"
        print("✓ Mapping size verified")

        # Verify task objects are correct
        for i, (num, task) in enumerate(task_map.items(), 1):
            assert isinstance(task, Task), f"Item {num} should be a Task"
            print(f"✓ Task {num}: {task.title[:30]}...")

        # Verify full titles are in task objects (no truncation)
        for num, task in task_map.items():
            original_title = tasks[num-1].title
            assert task.title == original_title, f"Task {num} title should not be truncated"
        print("✓ No title truncation verified")

        print("\n" + "=" * 50)
        print("All tree selection tests passed! ✓")
        return True

    except Exception as e:
        print(f"\n✗ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_tree_selection()
    sys.exit(0 if success else 1)
