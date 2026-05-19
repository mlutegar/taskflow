"""Storage layer for TaskFlow - JSON persistence"""

import json
import os
from pathlib import Path
from typing import List, Optional
from taskflow.models import Task, RoutineTask, SavedTask


class TaskStorage:
    """Handles JSON-based persistence for tasks"""

    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.tasks_file = self.data_dir / "tasks.json"
        self._ensure_data_dir()

    def _ensure_data_dir(self) -> None:
        """Create data directory if it doesn't exist"""
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def load_tasks(self) -> List[Task]:
        """Load all tasks from JSON file"""
        if not self.tasks_file.exists():
            return []

        try:
            with open(self.tasks_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return [Task.from_dict(task_data) for task_data in data]
        except (json.JSONDecodeError, KeyError):
            return []

    def save_tasks(self, tasks: List[Task]) -> None:
        """Save all tasks to JSON file"""
        data = [task.to_dict() for task in tasks]
        with open(self.tasks_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def add_task(self, task: Task) -> None:
        """Add a new task"""
        tasks = self.load_tasks()
        tasks.append(task)
        self.save_tasks(tasks)

    def get_task(self, task_id: str) -> Optional[Task]:
        """Get a specific task by ID"""
        tasks = self.load_tasks()
        for task in tasks:
            if task.id == task_id:
                return task
        return None

    def update_task(self, updated_task: Task) -> bool:
        """Update an existing task"""
        tasks = self.load_tasks()
        for i, task in enumerate(tasks):
            if task.id == updated_task.id:
                tasks[i] = updated_task
                self.save_tasks(tasks)
                return True
        return False

    def delete_task(self, task_id: str) -> bool:
        """Delete a task by ID"""
        tasks = self.load_tasks()
        original_length = len(tasks)
        tasks = [task for task in tasks if task.id != task_id]
        if len(tasks) < original_length:
            self.save_tasks(tasks)
            return True
        return False

    def get_active_tasks(self) -> List[Task]:
        """Get all incomplete tasks"""
        tasks = self.load_tasks()
        return [task for task in tasks if not task.completed]

    def get_completed_tasks(self) -> List[Task]:
        """Get all completed tasks"""
        tasks = self.load_tasks()
        return [task for task in tasks if task.completed]

    def get_sorted_tasks(self, sort_by: str = "priority") -> List[Task]:
        """Get tasks sorted by specified criteria.

        Args:
            sort_by: "priority", "due_date", or "created"

        Returns:
            Sorted list of tasks
        """
        tasks = self.load_tasks()

        if sort_by == "priority":
            return sorted(tasks, key=lambda t: t.priority)
        elif sort_by == "due_date":
            tasks_with_due = [t for t in tasks if t.due_date]
            tasks_without_due = [t for t in tasks if not t.due_date]
            return sorted(tasks_with_due, key=lambda t: t.due_date) + tasks_without_due
        else:  # "created" - original order
            return tasks


class RoutineStorage:
    """Handles JSON-based persistence for routine tasks"""

    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.routines_file = self.data_dir / "routines.json"
        self._ensure_data_dir()

    def _ensure_data_dir(self) -> None:
        """Create data directory if it doesn't exist"""
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def load_routines(self) -> List[RoutineTask]:
        """Load all routine tasks from JSON file"""
        if not self.routines_file.exists():
            return []

        try:
            with open(self.routines_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                routines = [RoutineTask.from_dict(task_data) for task_data in data]

                # Reset daily progress for routines that weren't completed today
                for routine in routines:
                    routine.reset_daily()

                return routines
        except (json.JSONDecodeError, KeyError):
            return []

    def save_routines(self, routines: List[RoutineTask]) -> None:
        """Save all routine tasks to JSON file"""
        data = [routine.to_dict() for routine in routines]
        with open(self.routines_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def add_routine(self, routine: RoutineTask) -> None:
        """Add a new routine task"""
        routines = self.load_routines()
        routines.append(routine)
        self.save_routines(routines)

    def get_routine(self, routine_id: str) -> Optional[RoutineTask]:
        """Get a specific routine task by ID"""
        routines = self.load_routines()
        for routine in routines:
            if routine.id == routine_id:
                return routine
        return None

    def update_routine(self, updated_routine: RoutineTask) -> bool:
        """Update an existing routine task"""
        routines = self.load_routines()
        for i, routine in enumerate(routines):
            if routine.id == updated_routine.id:
                routines[i] = updated_routine
                self.save_routines(routines)
                return True
        return False

    def delete_routine(self, routine_id: str) -> bool:
        """Delete a routine task by ID"""
        routines = self.load_routines()
        original_length = len(routines)
        routines = [routine for routine in routines if routine.id != routine_id]
        if len(routines) < original_length:
            self.save_routines(routines)
            return True
        return False

    def get_pending_routines(self) -> List[RoutineTask]:
        """Get all routine tasks that need completion today"""
        routines = self.load_routines()
        return [routine for routine in routines if routine.needs_completion]

    def get_completed_routines(self) -> List[RoutineTask]:
        """Get all routine tasks completed today"""
        routines = self.load_routines()
        return [routine for routine in routines if routine.is_completed_today]

    def get_all_routines(self) -> List[RoutineTask]:
        """Get all routine tasks"""
        return self.load_routines()


class SavedTaskStorage:
    """Handles JSON-based persistence for saved tasks in Lazy Falcon Mode"""

    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.saved_tasks_file = self.data_dir / "saved_tasks.json"
        self._ensure_data_dir()

    def _ensure_data_dir(self) -> None:
        """Create data directory if it doesn't exist"""
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def load_saved_tasks(self) -> List[SavedTask]:
        """Load all saved tasks from JSON file"""
        if not self.saved_tasks_file.exists():
            return []

        try:
            with open(self.saved_tasks_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                # Handle both old format (list) and new format (dict with 'saved_tasks' key)
                if isinstance(data, list):
                    # Old format - direct list
                    return [SavedTask.from_dict(task_data) for task_data in data]
                elif isinstance(data, dict) and "saved_tasks" in data:
                    # New format - dict with saved_tasks key
                    return [SavedTask.from_dict(task_data) for task_data in data["saved_tasks"]]
                else:
                    # Invalid format
                    return []
        except (json.JSONDecodeError, KeyError):
            # Corrupted file - return empty list
            return []

    def save_saved_tasks(self, saved_tasks: List[SavedTask]) -> None:
        """Save all saved tasks to JSON file"""
        data = {
            "saved_tasks": [saved_task.to_dict() for saved_task in saved_tasks]
        }
        with open(self.saved_tasks_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def add_saved_task(self, saved_task: SavedTask) -> None:
        """Add a new saved task"""
        saved_tasks = self.load_saved_tasks()
        saved_tasks.append(saved_task)
        self.save_saved_tasks(saved_tasks)

    def get_saved_task(self, task_id: str) -> Optional[SavedTask]:
        """Get a specific saved task by task_id"""
        saved_tasks = self.load_saved_tasks()
        for saved_task in saved_tasks:
            if saved_task.task_id == task_id:
                return saved_task
        return None

    def update_saved_task(self, updated_saved_task: SavedTask) -> bool:
        """Update an existing saved task"""
        saved_tasks = self.load_saved_tasks()
        for i, saved_task in enumerate(saved_tasks):
            if saved_task.task_id == updated_saved_task.task_id:
                saved_tasks[i] = updated_saved_task
                self.save_saved_tasks(saved_tasks)
                return True
        return False

    def remove_saved_task(self, task_id: str) -> bool:
        """Remove a saved task by task_id"""
        saved_tasks = self.load_saved_tasks()
        original_length = len(saved_tasks)
        saved_tasks = [st for st in saved_tasks if st.task_id != task_id]
        if len(saved_tasks) < original_length:
            self.save_saved_tasks(saved_tasks)
            return True
        return False

    def clear_all_saved_tasks(self) -> None:
        """Remove all saved tasks"""
        self.save_saved_tasks([])
