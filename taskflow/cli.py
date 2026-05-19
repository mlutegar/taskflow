"""Main CLI interface for TaskFlow"""

import sys
from typing import Optional
import typer
import questionary
from rich.console import Console

from taskflow.storage import TaskStorage, RoutineStorage
from taskflow.models import Task, RoutineTask
from taskflow.modes import MusicMode, TikTokMode, SpliteMode, MomentumMode, EspressoSprintMode, RPGClassMode, LazyFalconMode
from taskflow.utils import (
    print_header, print_menu, print_task_list, print_task_detail,
    print_success, print_error, print_info, pause, clear_screen, print_tree_view,
    print_tree_for_selection, create_console
)

console = create_console()
app = typer.Typer(help="TaskFlow - CLI Task Manager with Gamified Execution Modes")
storage = TaskStorage()
routine_storage = RoutineStorage()


def get_view_mode() -> str:
    """Ask user to select view mode (table or tree)

    Returns:
        'table_all', 'table_active', 'tree_all', or 'tree_active'
    """
    choice = questionary.select(
        "Modo de visualização?",
        choices=[
            {"name": "📊 Tabela (Table) - Todas", "value": "table_all"},
            {"name": "📊 Tabela (Table) - Apenas Ativas", "value": "table_active"},
            {"name": "🌳 Árvore (Tree) - Todas", "value": "tree_all"},
            {"name": "🌳 Árvore (Tree) - Apenas Ativas", "value": "tree_active"},
        ],
    ).ask()
    return choice if choice else "table_all"


def main_menu() -> int:
    """Display and handle main menu"""
    clear_screen()
    print_header("TaskFlow - Productivity")
    console.print("")

    menu_options = [
        ("1", "Manage Tasks"),
        ("2", "Manage Routine"),
        ("3", "Music Doing Mode"),
        ("4", "TikTok Mode"),
        ("5", "Splite Mode"),
        ("6", "Momentum Mode"),
        ("7", "Espresso Sprint Mode"),
        ("8", "RPG Class Mode"),
        ("9", "Lazy Falcon Mode"),
        ("10", "Manage Activities"),
        ("11", "View All Items (Tree Format)"),
        ("12", "Exit"),
    ]

    print_menu(menu_options)

    choice = questionary.select(
        "What do you want to do?",
        choices=[
            {"name": "Manage Tasks", "value": 1},
            {"name": "Manage Routine", "value": 2},
            {"name": "Music Doing Mode", "value": 3},
            {"name": "TikTok Mode", "value": 4},
            {"name": "Splite Mode", "value": 5},
            {"name": "Momentum Mode", "value": 6},
            {"name": "Espresso Sprint Mode", "value": 7},
            {"name": "RPG Class Mode", "value": 8},
            {"name": "Lazy Falcon Mode", "value": 9},
            {"name": "Manage Activities", "value": 10},
            {"name": "View All Items (Tree Format)", "value": 11},
            {"name": "Exit", "value": 12},
        ],
    ).ask()

    return choice if choice is not None else 12


def task_management_menu() -> None:
    """Handle task management submenu"""
    while True:
        console.print("\n")
        choice = questionary.select(
            "Task Management",
            choices=[
                {"name": "Add new task", "value": 1},
                {"name": "Add checklist to task", "value": 2},
                {"name": "List all tasks", "value": 3},
                {"name": "List active tasks", "value": 4},
                {"name": "List completed tasks", "value": 5},
                {"name": "Mark task as completed", "value": 6},
                {"name": "Delete task", "value": 7},
                {"name": "Edit task", "value": 8},
                {"name": "Back to main menu", "value": 9},
            ],
        ).ask()

        if choice is None or choice == 9:
            break

        handle_task_choice(choice)


def handle_task_choice(choice: int) -> None:
    """Handle task management menu choice"""
    if choice == 1:
        add_new_task()
    elif choice == 2:
        add_checklist()
    elif choice == 3:
        list_all_tasks()
    elif choice == 4:
        list_active_tasks()
    elif choice == 5:
        list_completed_tasks()
    elif choice == 6:
        mark_task_completed()
    elif choice == 7:
        delete_task()
    elif choice == 8:
        edit_task()


def add_new_task() -> None:
    """Add a new task"""
    console.print("\n[bold_cyan]Add New Task[/bold_cyan]\n")

    title = questionary.text("Task title:").ask()
    if not title:
        print_error("Title is required!")
        return

    description = questionary.text("Description (optional, press ENTER to skip):").ask()

    # Priority selection (optional)
    priority = 4  # default Baixa
    set_priority = questionary.confirm("Set priority?", default=False).ask()

    if set_priority:
        priority = questionary.select(
            "Select priority:",
            choices=[
                {"name": "🔴 Crítica", "value": 1},
                {"name": "🟠 Alta", "value": 2},
                {"name": "🟡 Média", "value": 3},
                {"name": "🟢 Baixa", "value": 4},
            ],
        ).ask()

    # Due date (optional)
    due_date = None
    set_due_date = questionary.confirm("Set due date?", default=False).ask()

    if set_due_date:
        due_date = questionary.text(
            "Due date (YYYY-MM-DD, e.g., 2026-04-10):",
        ).ask()
        # Basic validation
        if not due_date or len(due_date) != 10:
            due_date = None

    task = Task.create(
        title=title,
        description=description or None,
        priority=priority,
        due_date=due_date
    )
    storage.add_task(task)

    print_success(f"Task '{title}' added!")
    pause()


def add_checklist() -> None:
    """Add checklist items to a task"""
    active_tasks = storage.get_active_tasks()

    if not active_tasks:
        print_error("No active tasks found!")
        pause()
        return

    console.print("\n[bold_cyan]Add Checklist to Task[/bold_cyan]\n")

    # Default to tree mode for best checklist viewing experience
    view_mode = "tree_active"

    # Filter tasks based on view mode (though active_tasks are already filtered)
    display_tasks = active_tasks
    if "active" in view_mode:
        display_tasks = [t for t in active_tasks if not t.completed]

    task = None

    if "table" in view_mode:
        # Table mode - use existing logic
        # Select task
        task_choices = [f"{i+1}. {task.title}" for i, task in enumerate(display_tasks)]
        task_choices.append("Cancel")

        choice = questionary.select(
            "Select a task:",
            choices=task_choices
        ).ask()

        if choice is None or choice == "Cancel":
            return

        task_index = task_choices.index(choice)
        task = display_tasks[task_index]

    else:  # tree mode
        # Tree mode - use tree selection
        task_map = print_tree_for_selection(display_tasks)

        # Get numeric input
        task_num_input = questionary.text("Digite o número da tarefa (ou 0 para voltar):").ask()

        if not task_num_input:
            return

        try:
            task_num = int(task_num_input)
            if task_num == 0:
                return
            if task_num in task_map:
                task = task_map[task_num]
            else:
                print_error("Número de tarefa inválido!")
                pause()
                return
        except ValueError:
            print_error("Por favor, digite um número válido!")
            pause()
            return

    # Add checklist items
    console.print(f"\n[bold_cyan]Adding checklist to: {task.title}[/bold_cyan]")
    console.print("[dim]Press ENTER with empty text to finish[/dim]\n")

    while True:
        item_text = questionary.text(f"Checklist item {len(task.checklist) + 1}:").ask()

        if not item_text or item_text.strip() == "":
            break

        task.add_checklist_item(item_text)
        print_success(f"Added: {item_text}")

    if task.checklist:
        storage.update_task(task)
        print_success(f"Checklist with {len(task.checklist)} items added to '{task.title}'!")
    else:
        print_info("No checklist items added")

    pause()


def list_all_tasks() -> None:
    """List all tasks with sorting option"""
    sort_choice = questionary.select(
        "Sort by:",
        choices=[
            {"name": "Priority", "value": "priority"},
            {"name": "Due Date", "value": "due_date"},
            {"name": "Creation Date", "value": "created"},
        ],
    ).ask()

    if sort_choice == "created":
        tasks = storage.load_tasks()  # Original behavior
    else:
        tasks = storage.get_sorted_tasks(sort_by=sort_choice)

    print_task_list(tasks, f"All Tasks (sorted by {sort_choice})")
    pause()


def list_active_tasks() -> None:
    """List active (incomplete) tasks with sorting option"""
    sort_choice = questionary.select(
        "Sort by:",
        choices=[
            {"name": "Priority", "value": "priority"},
            {"name": "Due Date", "value": "due_date"},
            {"name": "Creation Date", "value": "created"},
        ],
    ).ask()

    if sort_choice == "created":
        tasks = storage.get_active_tasks()  # Original behavior
    else:
        tasks = storage.get_sorted_tasks(sort_by=sort_choice)
        tasks = [t for t in tasks if not t.completed]  # Filter active only

    print_task_list(tasks, f"Active Tasks (sorted by {sort_choice})")
    pause()


def list_completed_tasks() -> None:
    """List completed tasks"""
    tasks = storage.get_completed_tasks()
    print_task_list(tasks, "Completed Tasks")
    pause()


def mark_task_completed() -> None:
    """Mark a task as completed"""
    from taskflow.modes.base import BaseMode

    active_tasks = storage.get_active_tasks()

    if not active_tasks:
        print_error("No active tasks found!")
        pause()
        return

    console.print("\n[bold_cyan]Mark Task as Completed[/bold_cyan]\n")

    # Ask for view mode
    view_mode = get_view_mode()

    # Filter tasks based on view mode (though active_tasks are already filtered)
    display_tasks = active_tasks
    if "active" in view_mode:
        display_tasks = [t for t in active_tasks if not t.completed]

    task = None

    if "table" in view_mode:
        # Table mode - use existing logic
        print_task_list(display_tasks)

        # Select task
        task_choices = [f"{i+1}. {task.title}" for i, task in enumerate(display_tasks)]
        task_choices.append("Cancel")

        choice = questionary.select(
            "Select a task to mark as completed:",
            choices=task_choices
        ).ask()

        if choice is None or choice == "Cancel":
            return

        task_index = task_choices.index(choice)
        task = display_tasks[task_index]

    else:  # tree mode
        # Tree mode - use new tree selection
        task_map = print_tree_for_selection(display_tasks)

        # Get numeric input
        task_num_input = questionary.text("Enter task number (or 0 to go back):").ask()

        if not task_num_input:
            return

        try:
            task_num = int(task_num_input)
            if task_num == 0:
                return
            if task_num in task_map:
                task = task_map[task_num]
            else:
                print_error("Invalid task number!")
                pause()
                return
        except ValueError:
            print_error("Please enter a valid number!")
            pause()
            return

    # Use the BaseMode completion logic
    mode = BaseMode(storage)
    mode.complete_task(task)

    pause()


def delete_task() -> None:
    """Delete a task"""
    all_tasks = storage.load_tasks()

    if not all_tasks:
        print_error("No tasks found!")
        pause()
        return

    console.print("\n[bright_red]Delete Task[/bright_red]\n")

    # Ask for view mode
    view_mode = get_view_mode()

    # Filter tasks based on view mode
    display_tasks = all_tasks
    if "active" in view_mode:
        display_tasks = [t for t in all_tasks if not t.completed]

    task = None

    if "table" in view_mode:
        # Table mode - use existing logic
        print_task_list(display_tasks)

        # Select task
        task_choices = [f"{i+1}. {t.title}" for i, t in enumerate(display_tasks)]
        task_choices.append("Cancel")

        choice = questionary.select(
            "Select a task to delete:",
            choices=task_choices
        ).ask()

        if choice is None or choice == "Cancel":
            return

        task_index = task_choices.index(choice)
        task = display_tasks[task_index]

    else:  # tree mode
        # Tree mode - use new tree selection
        task_map = print_tree_for_selection(display_tasks)

        # Get numeric input
        task_num_input = questionary.text("Enter task number (or 0 to go back):").ask()

        if not task_num_input:
            return

        try:
            task_num = int(task_num_input)
            if task_num == 0:
                return
            if task_num in task_map:
                task = task_map[task_num]
            else:
                print_error("Invalid task number!")
                pause()
                return
        except ValueError:
            print_error("Please enter a valid number!")
            pause()
            return

    # Confirm deletion
    confirm = questionary.confirm(
        f"Are you sure you want to delete '{task.title}'?",
        default=False
    ).ask()

    if confirm:
        storage.delete_task(task.id)
        print_success(f"Task '{task.title}' deleted!")
    else:
        print_info("Deletion cancelled")

    pause()


def run_music_mode() -> None:
    """Run Music Doing Mode"""
    mode = MusicMode(storage)
    mode.run()


def run_tiktok_mode() -> None:
    """Run TikTok Mode"""
    mode = TikTokMode(storage)
    mode.run()


def run_splite_mode() -> None:
    """Run Splite Mode"""
    mode = SpliteMode(storage)
    mode.run()


def run_momentum_mode() -> None:
    """Run Momentum Mode"""
    mode = MomentumMode(storage)
    mode.run()


def run_espresso_sprint_mode() -> None:
    """Run Espresso Sprint Mode"""
    mode = EspressoSprintMode(storage)
    mode.run()


def run_rpg_class_mode() -> None:
    """Run RPG Class Mode"""
    mode = RPGClassMode(storage)
    mode.run()


def run_lazy_falcon_mode() -> None:
    """Run Lazy Falcon Mode"""
    mode = LazyFalconMode(storage)
    mode.run()


def manage_activities() -> None:
    """Manage activities list"""
    mode = SpliteMode(storage)

    # Show all activities
    from taskflow.utils import print_separator

    clear_screen()
    print_header("🎯 Manage Activities")
    console.print("")

    console.print("[bold_cyan]Current Activities:[/bold_cyan]\n")

    for i, activity in enumerate(mode.activities, 1):
        console.print(f"  [bright_cyan]{i}.[/bright_cyan] {activity}")

    console.print(f"\n[dim]Total: {len(mode.activities)} activities[/dim]")
    print_separator("—", 40)

    # Ask what to do
    from questionary import select

    choices = [
        {"name": "➕ Add new activity", "value": "add"},
        {"name": "❌ Remove activity", "value": "remove"},
        {"name": "🔙 Back to menu", "value": "back"},
    ]

    action = select("What do you want to do?", choices=choices).ask()

    if action == "add":
        from questionary import text
        new_activity = text("Enter new activity:").ask()
        if new_activity and new_activity.strip():
            mode.activities.append(new_activity.strip())
            mode._save_activities(mode.activities)
            console.print(f"\n[bold_green]✓ Added '{new_activity.strip()}'![/bold_green]")
            pause()
        else:
            console.print("\n[bright_yellow]Activity cannot be empty![/bright_yellow]")
            pause()

    elif action == "remove":
        if not mode.activities:
            console.print("\n[bright_yellow]No activities to remove![/bright_yellow]")
            pause()
            return

        # Create choices with activity names
        remove_choices = [{"name": activity, "value": i} for i, activity in enumerate(mode.activities)]
        remove_choices.append({"name": "🔙 Cancel", "value": -1})

        index = select("Select activity to remove:", choices=remove_choices).ask()

        if index is not None and index >= 0:
            removed = mode.activities.pop(index)
            mode._save_activities(mode.activities)
            console.print(f"\n[bold_green]✓ Removed '{removed}'![/bold_green]")
            pause()


def view_all_items_tree() -> None:
    """Display all items in tree format with filtering options"""
    from taskflow.modes.splite import SpliteMode

    # Ask for filter preference
    filter_choice = questionary.select(
        "Which items would you like to see?",
        choices=[
            {"name": "Show All", "value": "all"},
            {"name": "Show Active Only", "value": "active"},
            {"name": "Show Completed Only", "value": "completed"},
            {"name": "Cancel", "value": None},
        ]
    ).ask()

    if filter_choice is None:
        return

    # Load all data
    all_tasks = storage.load_tasks()
    all_routines = routine_storage.get_all_routines()
    mode = SpliteMode(storage)
    all_activities = mode.activities

    # Apply filter
    show_completed = filter_choice in ["all", "completed"]
    show_active = filter_choice in ["all", "active"]

    # Clear screen and display
    clear_screen()
    print_header("All Items - Tree View")
    console.print("")

    print_tree_view(
        tasks=all_tasks,
        routines=all_routines,
        activities=all_activities,
        show_completed=show_completed,
        show_active=show_active
    )

    console.print(f"\n[dim]Total: {len(all_tasks)} tasks, {len(all_routines)} routines, {len(all_activities)} activities[/dim]")
    pause()


def routine_management_menu() -> None:
    """Handle routine management submenu"""
    while True:
        console.print("\n")
        choice = questionary.select(
            "Routine Management",
            choices=[
                {"name": "Add new routine", "value": 1},
                {"name": "List all routines", "value": 2},
                {"name": "List pending routines (today)", "value": 3},
                {"name": "List completed routines (today)", "value": 4},
                {"name": "Update routine progress", "value": 5},
                {"name": "Mark routine as completed", "value": 6},
                {"name": "Add checklist to routine", "value": 7},
                {"name": "Delete routine", "value": 8},
                {"name": "Edit routine", "value": 9},
                {"name": "View Heatmap", "value": 10},
                {"name": "Back to main menu", "value": 11},
            ],
        ).ask()

        if choice is None or choice == 11:
            break

        handle_routine_choice(choice)


def handle_routine_choice(choice: int) -> None:
    """Handle routine management menu choice"""
    if choice == 1:
        add_new_routine()
    elif choice == 2:
        list_all_routines()
    elif choice == 3:
        list_pending_routines()
    elif choice == 4:
        list_completed_routines()
    elif choice == 5:
        update_routine_progress()
    elif choice == 6:
        mark_routine_completed()
    elif choice == 7:
        add_checklist_to_routine()
    elif choice == 8:
        delete_routine()
    elif choice == 9:
        edit_routine()
    elif choice == 10:
        open_routine_heatmap()


def open_routine_heatmap() -> None:
    """Open the routine heatmap in the default browser"""
    from taskflow.heatmap import open_heatmap
    open_heatmap()
    print_info("Heatmap aberto no navegador!")
    pause()


def add_new_routine() -> None:
    """Add a new routine task"""
    console.print("\n[bold_cyan]Add New Routine[/bold_cyan]\n")

    title = questionary.text("Routine title:").ask()
    if not title:
        print_error("Title is required!")
        return

    description = questionary.text("Description (optional, press ENTER to skip):").ask()

    # Ask if has target value
    has_target = questionary.confirm("Does this routine have a target value? (e.g., 4.5L water)", default=False).ask()

    target_value = None
    unit = None

    if has_target:
        target_input = questionary.text("Target value (number):").ask()
        if target_input:
            try:
                target_value = float(target_input)
            except ValueError:
                print_error("Invalid number!")
                return

        unit = questionary.text("Unit (e.g., L, hours, times):").ask()

    routine = RoutineTask.create(
        title=title,
        description=description or None,
        target_value=target_value,
        unit=unit or None
    )

    routine_storage.add_routine(routine)

    if target_value:
        print_success(f"Routine '{title}' added with target: {target_value} {unit or ''}!")
    else:
        print_success(f"Routine '{title}' added!")

    pause()


def list_all_routines() -> None:
    """List all routine tasks"""
    routines = routine_storage.get_all_routines()
    print_routine_list(routines, "All Routines")
    pause()


def list_pending_routines() -> None:
    """List pending routine tasks for today"""
    routines = routine_storage.get_pending_routines()

    if not routines:
        console.print("\n[bold_green]🎉 All routines completed for today![/bold_green]\n")
        pause()
        return

    print_routine_list(routines, "Pending Routines (Today)")
    pause()


def list_completed_routines() -> None:
    """List completed routine tasks for today"""
    routines = routine_storage.get_completed_routines()

    if not routines:
        console.print("\n[bright_yellow]No routines completed yet today.[/bright_yellow]\n")
        pause()
        return

    print_routine_list(routines, "Completed Routines (Today)")
    pause()


def print_routine_list(routines: list, title: str) -> None:
    """Print a formatted list of routine tasks"""
    if not routines:
        from rich.panel import Panel
        console.print(Panel("No routines found.", border_style="bright_black"))
        return

    from rich.table import Table

    table = Table(title=title, show_header=True, header_style="bold magenta")
    table.add_column("#", style="bright_cyan", width=4)
    table.add_column("Title", style="white")
    table.add_column("Target", style="dim")
    table.add_column("Progress", style="bright_yellow")
    table.add_column("Status", style="bright_green")

    for i, routine in enumerate(routines, 1):
        target_display = ""
        if routine.target_value:
            target_display = f"{routine.target_value} {routine.unit or ''}"

        progress_display = routine.get_status_display()

        status = "[bright_green]✓[/bright_green]" if routine.is_completed_today else "[bright_red]○[/bright_red]"

        table.add_row(
            str(i),
            routine.title[:30],
            target_display,
            progress_display,
            status
        )

    console.print(table)


def update_routine_progress() -> None:
    """Update progress for a routine with target value"""
    pending_routines = routine_storage.get_pending_routines()

    # Filter routines that have target values
    quantifiable_routines = [r for r in pending_routines if r.target_value is not None]

    if not quantifiable_routines:
        print_error("No routines with target values found!")
        pause()
        return

    console.print("\n[bold_cyan]Update Routine Progress[/bold_cyan]\n")

    # Select routine
    routine_choices = [f"{i+1}. {r.title} ({r.current_progress}/{r.target_value} {r.unit or ''})"
                       for i, r in enumerate(quantifiable_routines)]
    routine_choices.append("Cancel")

    choice = questionary.select("Select a routine:", choices=routine_choices).ask()

    if choice is None or choice == "Cancel":
        return

    routine_index = routine_choices.index(choice)
    routine = quantifiable_routines[routine_index]

    # Get amount to add
    amount_input = console.input(
        f"[bright_cyan]How much to add to '{routine.title}'? (current: {routine.current_progress}/{routine.target_value} {routine.unit or ''})[/bright_cyan] "
    )

    try:
        amount = float(amount_input)
        routine.update_progress(amount)
        routine_storage.update_routine(routine)

        if routine.is_completed_today:
            print_success(f"Routine '{routine.title}' completed! ({routine.current_progress}/{routine.target_value} {routine.unit or ''})")
        else:
            print_success(f"Progress updated: {routine.current_progress}/{routine.target_value} {routine.unit or ''}")

    except ValueError:
        print_error("Invalid number!")

    pause()


def mark_routine_completed() -> None:
    """Mark a routine as completed for today"""
    pending_routines = routine_storage.get_pending_routines()

    if not pending_routines:
        console.print("\n[bold_green]🎉 All routines already completed for today![/bold_green]\n")
        pause()
        return

    console.print("\n[bold_cyan]Mark Routine as Completed[/bold_cyan]\n")

    # Select routine
    routine_choices = [f"{i+1}. {r.title}" for i, r in enumerate(pending_routines)]
    routine_choices.append("Cancel")

    choice = questionary.select("Select a routine to mark as completed:", choices=routine_choices).ask()

    if choice is None or choice == "Cancel":
        return

    routine_index = routine_choices.index(choice)
    routine = pending_routines[routine_index]

    # Mark as completed
    routine.mark_completed()
    routine_storage.update_routine(routine)

    print_success(f"Routine '{routine.title}' marked as completed for today!")
    pause()


def add_checklist_to_routine() -> None:
    """Add checklist items to a routine task"""
    all_routines = routine_storage.get_pending_routines()

    if not all_routines:
        print_error("No pending routines found!")
        pause()
        return

    console.print("\n[bold_cyan]Add Checklist to Routine[/bold_cyan]\n")

    # Select routine
    routine_choices = [f"{i+1}. {r.title}" for i, r in enumerate(all_routines)]
    routine_choices.append("Cancel")

    choice = questionary.select("Select a routine:", choices=routine_choices).ask()

    if choice is None or choice == "Cancel":
        return

    routine_index = routine_choices.index(choice)
    routine = all_routines[routine_index]

    # Add checklist items
    console.print(f"\n[bold_cyan]Adding checklist to: {routine.title}[/bold_cyan]")
    console.print("[dim]Press ENTER with empty text to finish[/dim]\n")

    while True:
        item_text = questionary.text(f"Checklist item {len(routine.checklist) + 1}:").ask()

        if not item_text or item_text.strip() == "":
            break

        routine.add_checklist_item(item_text)
        print_success(f"Added: {item_text}")

    if routine.checklist:
        routine_storage.update_routine(routine)
        print_success(f"Checklist with {len(routine.checklist)} items added to '{routine.title}'!")
    else:
        print_info("No checklist items added")

    pause()


def delete_routine() -> None:
    """Delete a routine task"""
    all_routines = routine_storage.get_all_routines()

    if not all_routines:
        print_error("No routines found!")
        pause()
        return

    console.print("\n[bold_red]Delete Routine[/bold_red]\n")
    print_routine_list(all_routines, "All Routines")

    # Select routine
    routine_choices = [f"{i+1}. {r.title}" for i, r in enumerate(all_routines)]
    routine_choices.append("Cancel")

    choice = questionary.select("Select a routine to delete:", choices=routine_choices).ask()

    if choice is None or choice == "Cancel":
        return

    routine_index = routine_choices.index(choice)
    routine = all_routines[routine_index]

    # Confirm deletion
    confirm = questionary.confirm(
        f"Are you sure you want to delete routine '{routine.title}'?",
        default=False
    ).ask()

    if confirm:
        routine_storage.delete_routine(routine.id)
        print_success(f"Routine '{routine.title}' deleted!")
    else:
        print_info("Deletion cancelled")

    pause()


def edit_task() -> None:
    """Edit an existing task"""
    all_tasks = storage.load_tasks()

    if not all_tasks:
        print_error("No tasks found!")
        pause()
        return

    console.print("\n[bold_cyan]Edit Task[/bold_cyan]\n")

    # Ask for view mode
    view_mode = get_view_mode()

    # Filter tasks based on view mode
    display_tasks = all_tasks
    if "active" in view_mode:
        display_tasks = [t for t in all_tasks if not t.completed]

    task = None

    if "table" in view_mode:
        # Table mode - use existing logic
        print_task_list(display_tasks, "Select a Task to Edit")
        console.print("")

        # Select task
        task_choices = [f"{i+1}. {t.title}" for i, t in enumerate(display_tasks)]
        task_choices.append("Cancel")

        choice = questionary.select("Select a task to edit:", choices=task_choices).ask()

        if choice is None or choice == "Cancel":
            return

        task_index = task_choices.index(choice)
        task = display_tasks[task_index]

    else:  # tree mode
        # Tree mode - use new tree selection
        task_map = print_tree_for_selection(display_tasks)

        # Get numeric input
        task_num_input = questionary.text("Enter task number (or 0 to go back):").ask()

        if not task_num_input:
            return

        try:
            task_num = int(task_num_input)
            if task_num == 0:
                return
            if task_num in task_map:
                task = task_map[task_num]
            else:
                print_error("Invalid task number!")
                pause()
                return
        except ValueError:
            print_error("Please enter a valid number!")
            pause()
            return

    # Show current values
    console.print(f"\n[dim]Current values:[/dim]")
    console.print(f"  Title: {task.title}")
    if task.description:
        console.print(f"  Description: {task.description}")

    # Show current priority
    priority_labels = {1: "🔴 Crítica", 2: "🟠 Alta", 3: "🟡 Média", 4: "🟢 Baixa"}
    console.print(f"  Priority: {priority_labels.get(task.priority, 'Unknown')}")

    # Show current due date
    if task.due_date:
        console.print(f"  Due Date: {task.due_date}")
    else:
        console.print(f"  Due Date: None")

    console.print("")

    # Ask what to edit
    choices = [
        {"name": "Edit title", "value": "title"},
        {"name": "Edit description", "value": "description"},
        {"name": "Edit priority", "value": "priority"},
        {"name": "Edit due date", "value": "due_date"},
        {"name": "Edit all", "value": "all"},
        {"name": "Cancel", "value": "cancel"},
    ]

    action = questionary.select("What do you want to edit?", choices=choices).ask()

    if action == "cancel" or action is None:
        return

    # Make changes
    if action in ["title", "all"]:
        new_title = questionary.text(f"New title (current: {task.title}):").ask()
        if new_title and new_title.strip():
            task.title = new_title.strip()

    if action in ["description", "all"]:
        new_description = questionary.text(
            f"New description (current: {task.description or 'None'}):"
        ).ask()
        task.description = new_description or None

    # Edit priority
    if action in ["priority", "all"]:
        new_priority = questionary.select(
            "New priority:",
            choices=[
                {"name": "🔴 Crítica", "value": 1},
                {"name": "🟠 Alta", "value": 2},
                {"name": "🟡 Média", "value": 3},
                {"name": "🟢 Baixa", "value": 4},
            ],
        ).ask()

        if new_priority is not None:
            task.priority = new_priority

    # Edit due date
    if action in ["due_date", "all"]:
        new_due_date = questionary.text(
            f"New due date (YYYY-MM-DD, current: {task.due_date or 'None'}):",
        ).ask()

        if not new_due_date or new_due_date.strip() == "":
            task.due_date = None
        elif len(new_due_date) == 10:
            task.due_date = new_due_date
        else:
            print_error("Invalid date format. Keeping current value.")

    # Save changes
    storage.update_task(task)
    print_success(f"Task '{task.title}' updated!")
    pause()


def edit_routine() -> None:
    """Edit an existing routine"""
    all_routines = routine_storage.get_all_routines()

    if not all_routines:
        print_error("No routines found!")
        pause()
        return

    console.print("\n[bold_cyan]Edit Routine[/bold_cyan]\n")
    print_routine_list(all_routines, "Select a Routine to Edit")
    console.print("")

    # Select routine
    routine_choices = [f"{i+1}. {r.title}" for i, r in enumerate(all_routines)]
    routine_choices.append("Cancel")

    choice = questionary.select("Select a routine to edit:", choices=routine_choices).ask()

    if choice is None or choice == "Cancel":
        return

    routine_index = routine_choices.index(choice)
    routine = all_routines[routine_index]

    # Show current values
    console.print(f"\n[dim]Current values:[/dim]")
    console.print(f"  Title: {routine.title}")
    if routine.description:
        console.print(f"  Description: {routine.description}")
    if routine.target_value:
        console.print(f"  Target: {routine.target_value} {routine.unit or ''}")
    console.print("")

    # Ask what to edit
    choices = [
        {"name": "Edit title", "value": "title"},
        {"name": "Edit description", "value": "description"},
        {"name": "Edit target value", "value": "target"},
        {"name": "Edit all", "value": "all"},
        {"name": "Cancel", "value": "cancel"},
    ]

    action = questionary.select("What do you want to edit?", choices=choices).ask()

    if action == "cancel" or action is None:
        return

    # Make changes
    if action in ["title", "all"]:
        new_title = questionary.text(f"New title (current: {routine.title}):").ask()
        if new_title and new_title.strip():
            routine.title = new_title.strip()

    if action in ["description", "all"]:
        new_description = questionary.text(
            f"New description (current: {routine.description or 'None'}):"
        ).ask()
        routine.description = new_description or None

    if action in ["target", "all"]:
        # Ask if wants to change target value
        has_target = questionary.confirm(
            f"Does this routine have a target value? (current: {routine.target_value or 'None'})",
            default=bool(routine.target_value)
        ).ask()

        if has_target:
            target_input = questionary.text(f"Target value (current: {routine.target_value or 'None'}):").ask()
            if target_input and target_input.strip():
                try:
                    routine.target_value = float(target_input)
                except ValueError:
                    print_error("Invalid number! Keeping current value.")

            unit_input = questionary.text(f"Unit (current: {routine.unit or 'None'}):").ask()
            routine.unit = unit_input or None
        else:
            routine.target_value = None
            routine.unit = None

    # Save changes
    routine_storage.update_routine(routine)
    print_success(f"Routine '{routine.title}' updated!")
    pause()


@app.command()
def routines_window():
    """Abre janela always-on-top com tarefas de rotina sempre visíveis"""
    from taskflow.routines_window import main as routines_window_main
    routines_window_main()


def main() -> None:
    """Main entry point"""
    try:
        while True:
            choice = main_menu()

            if choice is None:
                break

            if choice == 1:
                task_management_menu()
            elif choice == 2:
                routine_management_menu()
            elif choice == 3:
                run_music_mode()
            elif choice == 4:
                run_tiktok_mode()
            elif choice == 5:
                run_splite_mode()
            elif choice == 6:
                run_momentum_mode()
            elif choice == 7:
                run_espresso_sprint_mode()
            elif choice == 8:
                run_rpg_class_mode()
            elif choice == 9:
                run_lazy_falcon_mode()
            elif choice == 10:
                manage_activities()
            elif choice == 11:
                view_all_items_tree()
            elif choice == 12:
                console.print("\n[bright_cyan]Goodbye! See you next time! 👋[/bright_cyan]\n")
                break

    except KeyboardInterrupt:
        console.print("\n\n[bright_yellow]Interrupted by user. Goodbye! 👋[/bright_yellow]\n")
        sys.exit(0)


if __name__ == "__main__":
    app()
