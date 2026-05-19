"""Data models for TaskFlow"""

from dataclasses import dataclass, field, asdict
from typing import List, Optional
from datetime import datetime, date
import uuid


@dataclass
class ChecklistItem:
    """Represents a single checklist item within a task"""
    description: str
    completed: bool = False

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "ChecklistItem":
        return cls(**data)


@dataclass
class Task:
    """Represents a task with optional description and checklist"""
    id: str
    title: str
    description: Optional[str] = None
    checklist: List[ChecklistItem] = field(default_factory=list)
    completed: bool = False
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    priority: int = 4  # 1=Crítica, 2=Alta, 3=Média, 4=Baixa (default)
    due_date: Optional[str] = None  # ISO format date string (YYYY-MM-DD)

    def to_dict(self) -> dict:
        """Convert task to dictionary for JSON serialization"""
        data = asdict(self)
        data["checklist"] = [item.to_dict() for item in self.checklist]
        return data

    @classmethod
    def from_dict(cls, data: dict) -> "Task":
        """Create task from dictionary with backward compatibility"""
        checklist_data = data.pop("checklist", [])
        checklist = [ChecklistItem.from_dict(item) for item in checklist_data]

        # Set defaults for missing fields (backward compatibility)
        if "priority" not in data:
            data["priority"] = 4
        if "due_date" not in data:
            data["due_date"] = None

        return cls(checklist=checklist, **data)

    @classmethod
    def create(cls, title: str, description: Optional[str] = None, priority: int = 4, due_date: Optional[str] = None) -> "Task":
        """Create a new task with generated ID"""
        return cls(
            id=str(uuid.uuid4()),
            title=title,
            description=description,
            priority=priority,
            due_date=due_date
        )

    def add_checklist_item(self, description: str) -> None:
        """Add a new item to the checklist"""
        self.checklist.append(ChecklistItem(description=description))

    def toggle_checklist_item(self, index: int) -> None:
        """Toggle completion status of a checklist item"""
        if 0 <= index < len(self.checklist):
            self.checklist[index].completed = not self.checklist[index].completed

    def mark_completed(self) -> None:
        """Mark the task as completed"""
        self.completed = True

    @property
    def has_checklist(self) -> bool:
        """Check if task has a checklist"""
        return len(self.checklist) > 0

    @property
    def checklist_progress(self) -> tuple[int, int]:
        """Return (completed_items, total_items) for checklist"""
        completed = sum(1 for item in self.checklist if item.completed)
        return completed, len(self.checklist)


@dataclass
class RoutineTask:
    """Represents a recurring daily task"""
    id: str
    title: str
    description: Optional[str] = None
    target_value: Optional[float] = None  # For quantifiable goals (e.g., 4.5L water)
    unit: Optional[str] = None  # Unit of measurement (e.g., "L", "hours", "times")
    checklist: List[ChecklistItem] = field(default_factory=list)
    last_completed_date: Optional[str] = None  # ISO format date string (YYYY-MM-DD)
    current_progress: float = 0.0  # Progress towards target value
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    completion_history: List[str] = field(default_factory=list)  # All completion dates

    def to_dict(self) -> dict:
        """Convert routine task to dictionary for JSON serialization"""
        data = asdict(self)
        data["checklist"] = [item.to_dict() for item in self.checklist]
        return data

    @classmethod
    def from_dict(cls, data: dict) -> "RoutineTask":
        """Create routine task from dictionary"""
        checklist_data = data.pop("checklist", [])
        checklist = [ChecklistItem.from_dict(item) for item in checklist_data]

        # Convert types that may have been serialized as strings
        if "target_value" in data and data["target_value"] is not None:
            if isinstance(data["target_value"], str):
                try:
                    data["target_value"] = float(data["target_value"])
                except (ValueError, TypeError):
                    # If conversion fails (e.g., "L" instead of number), set to None
                    data["target_value"] = None

        # Ensure description is a string or None (handle corrupted data with numeric descriptions)
        if "description" in data and data["description"] is not None:
            if not isinstance(data["description"], str):
                data["description"] = str(data["description"])

        if "current_progress" in data:
            if isinstance(data["current_progress"], str):
                data["current_progress"] = float(data["current_progress"])

        if "completion_history" not in data:
            data["completion_history"] = []
            if data.get("last_completed_date"):
                data["completion_history"] = [data["last_completed_date"]]

        return cls(checklist=checklist, **data)

    @classmethod
    def create(cls, title: str, description: Optional[str] = None,
               target_value: Optional[float] = None, unit: Optional[str] = None) -> "RoutineTask":
        """Create a new routine task with generated ID"""
        return cls(
            id=str(uuid.uuid4()),
            title=title,
            description=description,
            target_value=target_value,
            unit=unit
        )

    def add_checklist_item(self, description: str) -> None:
        """Add a new item to the checklist"""
        self.checklist.append(ChecklistItem(description=description))

    def toggle_checklist_item(self, index: int) -> None:
        """Toggle completion status of a checklist item"""
        if 0 <= index < len(self.checklist):
            self.checklist[index].completed = not self.checklist[index].completed

    @property
    def has_checklist(self) -> bool:
        """Check if routine task has a checklist"""
        return len(self.checklist) > 0

    @property
    def checklist_progress(self) -> tuple[int, int]:
        """Return (completed_items, total_items) for checklist"""
        completed = sum(1 for item in self.checklist if item.completed)
        return completed, len(self.checklist)

    @property
    def is_completed_today(self) -> bool:
        """Check if routine task was completed today"""
        if self.last_completed_date is None:
            return False

        today = date.today().isoformat()
        return self.last_completed_date == today

    @property
    def needs_completion(self) -> bool:
        """Check if routine task needs to be completed today"""
        return not self.is_completed_today

    @property
    def progress_percentage(self) -> Optional[float]:
        """Calculate progress percentage towards target value"""
        if self.target_value is None or self.target_value == 0:
            return None
        return min(100.0, (self.current_progress / self.target_value) * 100.0)

    def mark_completed(self) -> None:
        """Mark the routine task as completed for today"""
        today = date.today().isoformat()
        self.last_completed_date = today
        if today not in self.completion_history:
            self.completion_history.append(today)

    def update_progress(self, amount: float) -> None:
        """Update progress towards target value"""
        if self.target_value is not None:
            self.current_progress = min(self.target_value, self.current_progress + amount)

            # Auto-complete if target reached
            if self.current_progress >= self.target_value:
                self.mark_completed()

    def reset_daily(self) -> None:
        """Reset daily progress (called automatically when checking is_completed_today)"""
        # Only reset if last completed was a different day
        if self.last_completed_date is not None:
            if self.last_completed_date != date.today().isoformat():
                self.current_progress = 0.0
                # Reset checklist items
                for item in self.checklist:
                    item.completed = False

    def get_status_display(self) -> str:
        """Get a formatted status display string"""
        if self.target_value is not None:
            percentage = self.progress_percentage or 0
            return f"{self.current_progress}/{self.target_value} {self.unit or ''} ({percentage:.1f}%)"
        elif self.has_checklist:
            completed, total = self.checklist_progress
            return f"{completed}/{total} items"
        else:
            return "✓ Done" if self.is_completed_today else "○ Pending"


@dataclass
class SavedTask:
    """Represents a task saved for later in Lazy Falcon Mode"""
    task_id: str
    saved_at: str
    notes: Optional[str] = None
    cycles_completed: int = 0
    last_worked_on: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert saved task to dictionary for JSON serialization"""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "SavedTask":
        """Create saved task from dictionary"""
        # Set defaults for missing fields (backward compatibility)
        if "notes" not in data:
            data["notes"] = None
        if "cycles_completed" not in data:
            data["cycles_completed"] = 0
        if "last_worked_on" not in data:
            data["last_worked_on"] = None

        return cls(**data)
