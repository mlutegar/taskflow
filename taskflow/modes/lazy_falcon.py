"""Lazy Falcon Mode - Progressive cycles with persistent saved tasks"""

import random
from datetime import date, timedelta, datetime
from typing import List, Optional
from taskflow.modes.base import BaseMode
from taskflow.utils import (
    console, print_header, print_separator,
    pause, clear_screen, print_task_list, print_success, print_info, print_error
)
from taskflow.models import SavedTask
from questionary import select, text


class LazyFalconMode(BaseMode):
    """Lazy Falcon Mode: Save tasks for later and work on them progressively"""

    # Default activities list
    DEFAULT_ACTIVITIES = [
        "Ler diário",
        "Escrever no diário",
        "Beber água",
        "Jogar Spelunky",
        "Ver Twitter",
        "Ver um vídeo",
        "Colocar música",
        "Ler um capítulo de livro",
        "Esticar 5 minutos",
        "Meditar",
        "Fazer exercícios rápidos",
        "Organizar algo",
        "Responder mensagens",
    ]

    def __init__(self, storage):
        from taskflow.storage import SavedTaskStorage

        super().__init__(storage)
        self.activities = self._load_activities()
        self.saved_storage = SavedTaskStorage()
        self.chosen_activity = None

    def _load_activities(self) -> List[str]:
        """Load activities from file or use defaults"""
        import json
        from pathlib import Path

        data_dir = Path("data")
        activities_file = data_dir / "activities.json"

        if activities_file.exists():
            try:
                with open(activities_file, "r", encoding="utf-8") as f:
                    activities = json.load(f)
                    if activities:
                        return activities
            except (json.JSONDecodeError, IOError):
                pass

        # Save defaults if file doesn't exist or is invalid
        self._save_activities(self.DEFAULT_ACTIVITIES)
        return self.DEFAULT_ACTIVITIES.copy()

    def _save_activities(self, activities: List[str]) -> None:
        """Save activities to file"""
        import json
        from pathlib import Path

        data_dir = Path("data")
        data_dir.mkdir(parents=True, exist_ok=True)

        activities_file = data_dir / "activities.json"
        with open(activities_file, "w", encoding="utf-8") as f:
            json.dump(activities, f, indent=2, ensure_ascii=False)

    def _generate_random_diary_date(self) -> str:
        """Generate a random date between 2024-02-20 and today.

        Returns:
            Date formatted as dd/mm/yyyy (Brazilian format)
        """
        start_date = date(2024, 2, 20)
        end_date = date.today()

        # Calculate the number of days between the two dates
        delta = end_date - start_date
        random_days = random.randint(0, delta.days)

        # Generate the random date
        random_date = start_date + timedelta(days=random_days)

        # Return in Brazilian format (dd/mm/yyyy)
        return random_date.strftime("%d/%m/%Y")

    def _choose_activity(self) -> str:
        """Let user choose an activity from the list"""
        console.print("\n[bold_cyan]🎯 Choose Your Activity:[/bold_cyan]\n")

        # Create choices with activity names
        choices = [{"name": activity, "value": activity} for activity in self.activities]

        result = select("Select an activity:", choices=choices).ask()

        if result is None:
            return None

        return result

    def _load_saved_tasks(self) -> List[SavedTask]:
        """Load saved tasks from storage"""
        return self.saved_storage.load_saved_tasks()

    def _save_saved_tasks(self, saved_tasks: List[SavedTask]) -> None:
        """Persist saved tasks to storage"""
        self.saved_storage.save_saved_tasks(saved_tasks)

    def _add_to_saved(self, task, notes: Optional[str] = None) -> None:
        """Add task to saved list"""
        saved_tasks = self._load_saved_tasks()

        # Check if task is already saved
        existing = self._is_saved(task.id)
        if existing:
            # Update existing saved task
            existing.cycles_completed += 1
            existing.last_worked_on = datetime.now().isoformat()
            if notes:
                existing.notes = notes
            self.saved_storage.update_saved_task(existing)
        else:
            # Create new saved task
            saved_task = SavedTask(
                task_id=task.id,
                saved_at=datetime.now().isoformat(),
                notes=notes,
                cycles_completed=1,
                last_worked_on=datetime.now().isoformat()
            )
            self.saved_storage.add_saved_task(saved_task)

    def _remove_from_saved(self, task_id: str) -> None:
        """Remove task from saved list"""
        self.saved_storage.remove_saved_task(task_id)

    def _is_saved(self, task_id: str) -> Optional[SavedTask]:
        """Check if task is saved"""
        return self.saved_storage.get_saved_task(task_id)

    def _update_saved_task_progress(self, task_id: str) -> None:
        """Increment cycles and update last_worked_on"""
        saved_task = self._is_saved(task_id)
        if saved_task:
            saved_task.cycles_completed += 1
            saved_task.last_worked_on = datetime.now().isoformat()
            self.saved_storage.update_saved_task(saved_task)

    def _display_saved_tasks(self) -> None:
        """Display saved tasks prominently"""
        saved_tasks = self._load_saved_tasks()

        if not saved_tasks:
            console.print("[dim]No saved tasks yet. Complete tasks and choose 'Keep for later' to save them.[/dim]\n")
            return

        console.print("[bold_cyan]═══ 💾 Saved Tasks ═══[/bold_cyan]\n")

        # Get actual task objects to display titles
        all_tasks = self.storage.load_tasks()
        task_map = {task.id: task for task in all_tasks}

        valid_saved_tasks = []
        for i, saved_task in enumerate(saved_tasks, 1):
            task = task_map.get(saved_task.task_id)
            if task:
                valid_saved_tasks.append(saved_task)
                notes_display = saved_task.notes if saved_task.notes else "[dim]No notes[/dim]"
                last_worked = saved_task.last_worked_on.split("T")[0] if saved_task.last_worked_on else "Unknown"
                console.print(f"  [bright_cyan]{i}.[/bright_cyan] 📋 {task.title}")
                console.print(f"     [dim]Cycles: {saved_task.cycles_completed} | Last worked: {last_worked}[/dim]")
                console.print(f"     📝 {notes_display}\n")
            else:
                # Task no longer exists in main list
                console.print(f"  [bright_red]{i}.[/bright_red] [dim]Task deleted (ID: {saved_task.task_id[:8]}...)[/dim]\n")

        # Clean up saved tasks for deleted tasks
        if len(valid_saved_tasks) < len(saved_tasks):
            console.print("[bright_yellow]⚠️ Some saved tasks refer to deleted tasks. Use 'Manage saved tasks' to clean up.[/bright_yellow]\n")

    def _manage_saved_tasks(self) -> None:
        """Menu to view, remove, add notes to saved tasks"""
        while True:
            saved_tasks = self._load_saved_tasks()

            if not saved_tasks:
                console.print("[bright_yellow]No saved tasks to manage.[/bright_yellow]\n")
                pause()
                return

            # Get actual task objects
            all_tasks = self.storage.load_tasks()
            task_map = {task.id: task for task in all_tasks}

            # Build choices
            choices = []
            for i, saved_task in enumerate(saved_tasks):
                task = task_map.get(saved_task.task_id)
                if task:
                    status = f"{task.title} ({saved_task.cycles_completed} cycles)"
                else:
                    status = f"[Deleted task] (ID: {saved_task.task_id[:8]}...)"
                choices.append({"name": status, "value": i})

            choices.append({"name": "🔙 Back to main menu", "value": -1})

            console.print("\n[bold_cyan]═══ Manage Saved Tasks ═══[/bold_cyan]\n")

            selection = select("Select a task to manage:", choices=choices).ask()

            if selection is None or selection == -1:
                return

            selected_saved = saved_tasks[selection]
            task = task_map.get(selected_saved.task_id)

            if not task:
                # Task was deleted - offer to remove from saved
                console.print(f"\n[bright_yellow]This task no longer exists in your task list.[/bright_yellow]\n")

                remove = select(
                    "Remove from saved tasks?",
                    choices=[
                        {"name": "Yes, remove", "value": True},
                        {"name": "No, keep", "value": False},
                    ]
                ).ask()

                if remove:
                    self._remove_from_saved(selected_saved.task_id)
                    print_success("Removed from saved tasks!")
                continue

            # Task exists - show management options
            console.print(f"\n[bold_cyan]Task:[/bold_cyan] {task.title}")
            console.print(f"[dim]Cycles completed: {selected_saved.cycles_completed}[/dim]")
            console.print(f"[dim]Last worked: {selected_saved.last_worked_on.split('T')[0] if selected_saved.last_worked_on else 'Unknown'}[/dim]")
            if selected_saved.notes:
                console.print(f"[dim]Notes: {selected_saved.notes}[/dim]")
            else:
                console.print("[dim]No notes[/dim]")
            console.print("")

            action = select(
                "What do you want to do?",
                choices=[
                    {"name": "📝 Add/Edit notes", "value": "notes"},
                    {"name": "❌ Remove from saved", "value": "remove"},
                    {"name": "🔙 Back", "value": "back"},
                ]
            ).ask()

            if action == "notes":
                new_notes = text("Enter notes (or leave empty to clear):").ask()
                selected_saved.notes = new_notes if new_notes else None
                self.saved_storage.update_saved_task(selected_saved)
                print_success("Notes updated!")

            elif action == "remove":
                confirm = select(
                    "Are you sure you want to remove this task from saved?",
                    choices=[
                        {"name": "Yes, remove", "value": True},
                        {"name": "No, cancel", "value": False},
                    ]
                ).ask()

                if confirm:
                    self._remove_from_saved(selected_saved.task_id)
                    print_success("Removed from saved tasks!")
                else:
                    console.print("[dim]Cancelled.[/dim]")

            elif action == "back" or action is None:
                continue

            pause()

    def _ask_keep_or_finalize(self, task) -> str:
        """Ask user what to do with completed task

        Returns:
            'finalize', 'keep_with_notes', 'keep_no_notes', 'continue', 'back'
        """
        console.print(f"\n[bold_cyan]What do you want to do with '{task.title}'?[/bold_cyan]\n")

        choices = [
            {"name": "✓ Finalize task (mark as completed)", "value": "finalize"},
            {"name": "💾 Keep for later with notes", "value": "keep_with_notes"},
            {"name": "💾 Keep for later (without notes)", "value": "keep_no_notes"},
            {"name": "○ Continue working", "value": "continue"},
            {"name": "🔙 Back to menu", "value": "back"},
        ]

        return select("Select an option:", choices=choices).ask()

    def run(self) -> None:
        """Execute Lazy Falcon Mode"""
        clear_screen()
        print_header("🦅 Lazy Falcon Mode")
        console.print("")
        console.print("[brightcyan]How it works:[/brightcyan]")
        console.print("  1. Choose an activity from the list")
        console.print("  2. Do progressive cycles with your activity")
        console.print("  3. After completing a task, choose to:")
        console.print("     [bright_yellow]✓ Finalize[/bright_yellow] - Mark as completed")
        console.print("     [bright_yellow]💾 Keep for later[/bright_yellow] - Save to work on progressively")
        console.print("")
        console.print("  [bright_yellow]Cycle 1:[/bright_yellow] Do activity 1x → Do 1 task")
        console.print("  [bright_yellow]Cycle 2:[/bright_yellow] Do activity 2x → Do 2 tasks")
        console.print("  [bright_yellow]Cycle 3:[/bright_yellow] Do activity 3x → Do 3 tasks")
        console.print("  And so on... (n × activity → n tasks)")
        console.print("")

        print_separator("—", 40)

        # Main menu loop
        while True:
            # Display saved tasks
            console.print("\n")
            self._display_saved_tasks()

            print_separator("—", 40)

            # Main menu
            console.print("\n[bold_cyan]What do you want to do?[/bold_cyan]\n")

            main_choice = select(
                "Select an option:",
                choices=[
                    {"name": "🎯 Start new activity cycle", "value": "cycle"},
                    {"name": "⚙️  Manage saved tasks", "value": "manage"},
                    {"name": "🔙 Exit", "value": "exit"},
                ]
            ).ask()

            if main_choice == "exit" or main_choice is None:
                console.print("\n[bright_yellow]Exiting Lazy Falcon Mode.[/bright_yellow]")
                break

            elif main_choice == "manage":
                self._manage_saved_tasks()
                continue

            elif main_choice == "cycle":
                # Start activity cycle
                if not self._run_activity_cycle():
                    # User cancelled or error
                    continue

        # Show session summary
        console.print("\n")
        self.show_session_summary()
        pause()

    def _run_activity_cycle(self) -> bool:
        """Run a single activity cycle

        Returns:
            True if cycle completed successfully, False if cancelled
        """
        # Choose activity
        self.chosen_activity = self._choose_activity()

        if self.chosen_activity is None:
            console.print("\n[bright_yellow]No activity selected.[/bright_yellow]")
            return False

        console.print(f"\n[bold_green]✓ Activity chosen:[/bold_green] {self.chosen_activity}")
        console.print("\n[bright_yellow]Let's begin![/bright_yellow]\n")

        # Check if there are enough tasks
        active_tasks = self.get_active_tasks()
        if len(active_tasks) < 1:
            console.print("[bright_red]You need at least 1 active task![/bright_red]")
            pause()
            return False

        # Start the cycle loop
        cycle = 1
        continue_cycle = True

        while continue_cycle:
            # Calculate activity repetitions and tasks for this cycle
            activity_count = cycle
            num_tasks = cycle

            console.print(f"\n[bold_magenta]═══ Cycle {cycle} ═══[/bold_magenta]")
            console.print(f"[bright_cyan]🎯 Do '{self.chosen_activity}' {activity_count} time(s)[/bright_cyan]")
            console.print(f"[bright_cyan]✅ Then complete {num_tasks} task(s)[/bright_cyan]\n")

            # Generate suggested dates for diary activities
            if self.chosen_activity in ["Escutar Diario", "Ler diário"]:
                dates = [self._generate_random_diary_date() for _ in range(cycle)]
                console.print("[bold_yellow]📅 Data(s) sugerida(s) para ler:[/bold_yellow]")
                for i, date_str in enumerate(dates, 1):
                    console.print(f"  [bright_cyan]{i}.[/bright_cyan] {date_str}")
                console.print("")

            pause("Press ENTER when you've done the activity... ")

            # Complete tasks
            tasks_to_complete = min(num_tasks, len(self.get_active_tasks()))

            if tasks_to_complete == 0:
                console.print("\n[bright_yellow]No more active tasks![/bright_yellow]")
                break

            for task_num in range(1, tasks_to_complete + 1):
                console.print(f"\n[bold_cyan]Task {task_num} of {tasks_to_complete}[/bold_cyan]")
                console.print("")

                result = self.select_task_with_management()

                if result['action'] == 'cancel':
                    should_return = self.handle_cancellation_in_cycle()
                    if should_return:
                        # Return to task selection for this cycle iteration
                        task_num -= 1  # Decrement so the loop will repeat this task
                        continue
                    else:
                        # User wants to exit mode completely
                        continue_cycle = False
                        break
                elif result['action'] == 'complete_task':
                    if result['task']:
                        # Ask what to do with the task
                        action = self._ask_keep_or_finalize(result['task'])

                        if action == 'finalize':
                            # Mark as completed
                            if self.complete_task(result['task']):
                                # Remove from saved if present
                                self._remove_from_saved(result['task'].id)

                        elif action in ['keep_with_notes', 'keep_no_notes']:
                            # Keep for later
                            notes = None
                            if action == 'keep_with_notes':
                                notes = text("Enter progress notes:").ask()
                            self._add_to_saved(result['task'], notes)
                            print_success(f"Task '{result['task'].title}' saved for later!")

                        elif action == 'continue':
                            # Continue working on the same task
                            task_num -= 1
                            continue

                        elif action == 'back':
                            # Back to menu
                            continue_cycle = False
                            break

                elif result['action'] == 'complete_routine':
                    if result['routine']:
                        self._complete_routine(result['routine'])

                else:  # add_task ou add_checklist
                    # Já adicionou/salvou, conta como atividade completa do ciclo
                    print_success("✓ Atividade registrada! Continuando...")
                    continue

            # Ask if user wants to continue
            if continue_cycle:
                console.print("\n")
                print_separator("—", 40)

                if len(self.get_active_tasks()) == 0:
                    console.print("\n[bright_green]🎉 All tasks completed![/bright_green]")
                    break

                choice = console.input(
                    "[bright_cyan]Continue to next cycle? (y/n):[/bright_cyan] "
                ).lower()

                if choice != "y":
                    continue_cycle = False
                else:
                    cycle += 1

        return True
