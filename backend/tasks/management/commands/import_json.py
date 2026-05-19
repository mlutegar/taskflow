"""Import tasks and routines from the CLI's JSON data files into the Django database."""
import json
from pathlib import Path
from django.core.management.base import BaseCommand
from tasks.models import Task, ChecklistItem, Routine, RoutineChecklistItem


DATA_DIR = Path(__file__).resolve().parents[4] / "data"


class Command(BaseCommand):
    help = "Import tasks and routines from data/*.json into the SQLite database"

    def add_arguments(self, parser):
        parser.add_argument("--skip-completed", action="store_true", help="Skip already completed tasks")
        parser.add_argument("--clear", action="store_true", help="Clear existing data before importing")

    def handle(self, *args, **options):
        if options["clear"]:
            Task.objects.all().delete()
            Routine.objects.all().delete()
            self.stdout.write(self.style.WARNING("Cleared all existing tasks and routines."))

        self._import_tasks(options)
        self._import_routines(options)

    def _import_tasks(self, options):
        tasks_file = DATA_DIR / "tasks.json"
        if not tasks_file.exists():
            self.stdout.write(self.style.WARNING("tasks.json not found, skipping."))
            return

        with open(tasks_file, encoding="utf-8") as f:
            data_list = json.load(f)

        created = skipped = 0
        for data in data_list:
            if options["skip_completed"] and data.get("completed"):
                skipped += 1
                continue
            if Task.objects.filter(id=data["id"]).exists():
                skipped += 1
                continue

            task = Task.objects.create(
                id=data["id"],
                title=data["title"],
                description=data.get("description"),
                completed=data.get("completed", False),
                priority=data.get("priority", 4),
                due_date=data.get("due_date") or None,
            )
            for i, item in enumerate(data.get("checklist", [])):
                ChecklistItem.objects.create(
                    task=task,
                    description=item["description"],
                    completed=item.get("completed", False),
                    order=i,
                )
            created += 1

        self.stdout.write(self.style.SUCCESS(f"Tasks: imported {created}, skipped {skipped}."))

    def _import_routines(self, options):
        routines_file = DATA_DIR / "routines.json"
        if not routines_file.exists():
            self.stdout.write(self.style.WARNING("routines.json not found, skipping."))
            return

        with open(routines_file, encoding="utf-8") as f:
            data_list = json.load(f)

        created = skipped = 0
        for data in data_list:
            if Routine.objects.filter(id=data["id"]).exists():
                skipped += 1
                continue

            target_value = data.get("target_value")
            if isinstance(target_value, str):
                try:
                    target_value = float(target_value)
                except (ValueError, TypeError):
                    target_value = None

            routine = Routine.objects.create(
                id=data["id"],
                title=data["title"],
                description=data.get("description"),
                target_value=target_value,
                unit=data.get("unit"),
                current_progress=float(data.get("current_progress", 0.0)),
                last_completed_date=data.get("last_completed_date") or None,
                completion_history=data.get("completion_history", []),
            )
            for i, item in enumerate(data.get("checklist", [])):
                RoutineChecklistItem.objects.create(
                    routine=routine,
                    description=item["description"],
                    completed=item.get("completed", False),
                    order=i,
                )
            created += 1

        self.stdout.write(self.style.SUCCESS(f"Routines: imported {created}, skipped {skipped}."))
