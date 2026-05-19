"""Utility functions for TaskFlow"""

import os
import sys
from typing import List, Optional
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich.tree import Tree
from taskflow.models import Task, RoutineTask


def create_console() -> Console:
    """Cria um Console do Rich configurado para UTF-8 no Windows.

    No Windows, configura stdout/stderr para UTF-8 para permitir a exibição
    de emojis Unicode (🔴, 🟠, 🟡, 🟢, ✅, ❌) usados na tree view.

    Returns:
        Console: Instância do Console do Rich configurada
    """
    # Configurar UTF-8 no Windows
    if os.name == 'nt':  # Windows
        try:
            # Forçar UTF-8 no stdout/stderr
            sys.stdout.reconfigure(encoding='utf-8')
            sys.stderr.reconfigure(encoding='utf-8')
        except (AttributeError, OSError):
            # Fallback para versões antigas do Python ou se a configuração falhar
            pass

    return Console()


console = create_console()


def print_header(title: str = "TaskFlow") -> None:
    """Print a styled header"""
    header = Panel(
        Text(title, justify="center", style="bold cyan"),
        border_style="bright_blue",
        padding=(1, 3)
    )
    console.print(header)


def print_menu(options: List[tuple[str, str]]) -> None:
    """Print a styled menu"""
    table = Table(show_header=False, box=None, padding=(0, 2))
    table.add_column("Option", style="bright_yellow")
    table.add_column("Description")

    for i, (key, description) in enumerate(options, 1):
        table.add_row(f"[brightcyan]{i}.[/brightcyan]", description)

    console.print(table)


def print_task_list(tasks: List[Task], title: str = "Tasks", show_back_option: bool = False) -> None:
    """Print a formatted list of tasks

    Args:
        tasks: List of tasks to display
        title: Title for the table
        show_back_option: If True, adds a back option row at the end
    """
    if not tasks:
        console.print(Panel("No tasks found.", border_style="bright_black"))
        return

    table = Table(title=title, show_header=True, header_style="bold magenta")
    table.add_column("#", style="bright_cyan", width=4)
    table.add_column("Pri", style="bright_red", width=4)
    table.add_column("Title", style="white")
    table.add_column("Description", style="dim")
    table.add_column("Due Date", style="bright_yellow", width=12)
    table.add_column("Status", style="bright_yellow", width=8)
    table.add_column("Checklist", style="bright_green", width=10)

    # Priority color mapping
    priority_icons = {
        1: "[bright_red]🔴[/bright_red]",  # Crítica
        2: "[red_orange]🟠[/red_orange]",  # Alta
        3: "[bright_yellow]🟡[/bright_yellow]",  # Média
        4: "[bright_green]🟢[/bright_green]",  # Baixa
    }

    from datetime import date

    for i, task in enumerate(tasks, 1):
        status = "[bright_green]✓[/bright_green]" if task.completed else "[bright_red]○[/bright_red]"

        # Priority display
        priority_display = priority_icons.get(task.priority, "⚪")

        # Due date with overdue indicator
        due_date_display = "—"
        if task.due_date:
            due_date_display = task.due_date
            # Check if overdue
            if not task.completed:
                try:
                    due_date_obj = date.fromisoformat(task.due_date)
                    if due_date_obj < date.today():
                        due_date_display = f"[bright_red]{task.due_date}![/bright_red]"
                except ValueError:
                    due_date_display = task.due_date  # Invalid date format

        checklist_info = ""
        if task.has_checklist:
            completed, total = task.checklist_progress
            checklist_info = f"{completed}/{total}"

        table.add_row(
            str(i),
            priority_display,
            task.title[:25],
            (task.description or "")[:20] or "—",
            due_date_display,
            status,
            checklist_info or "—"
        )

    # Add back option row if requested
    if show_back_option:
        table.add_row(
            "0",
            "",
            "[bright_yellow]🔙 Voltar[/bright_yellow]",
            "",
            "",
            "",
            ""
        )

    console.print(table)


def print_task_detail(task: Task) -> None:
    """Print detailed information about a single task"""
    # Priority labels
    priority_labels = {
        1: "🔴 Crítica",
        2: "🟠 Alta",
        3: "🟡 Média",
        4: "🟢 Baixa"
    }

    panel_content = f"[bold_cyan]Title:[/bold_cyan] {task.title}\n"

    if task.description:
        panel_content += f"[bold_cyan]Description:[/bold_cyan] {task.description}\n"

    # Priority display
    panel_content += f"[bold_cyan]Priority:[/bold_cyan] {priority_labels.get(task.priority, 'Unknown')}\n"

    # Due date display
    if task.due_date:
        from datetime import date
        try:
            due_date_obj = date.fromisoformat(task.due_date)
            if due_date_obj < date.today() and not task.completed:
                panel_content += f"[bold_cyan]Due Date:[/bold_cyan] [bright_red]{task.due_date} (OVERDUE)[/bright_red]\n"
            else:
                panel_content += f"[bold_cyan]Due Date:[/bold_cyan] {task.due_date}\n"
        except ValueError:
            panel_content += f"[bold_cyan]Due Date:[/bold_cyan] {task.due_date}\n"

    panel_content += f"[bold_cyan]Status:[/bold_cyan] {'[bright_green]Completed[/bright_green]' if task.completed else '[bright_yellow]Pending[/bright_yellow]'}\n"

    if task.has_checklist:
        panel_content += "\n[bold_cyan]Checklist:[/bold_cyan]\n"
        for i, item in enumerate(task.checklist, 1):
            status = "[bright_green]✓[/bright_green]" if item.completed else "[bright_red]○[/bright_red]"
            panel_content += f"  {status} {item.description}\n"

    console.print(Panel(panel_content, border_style="bright_blue"))


def format_task_choice(task: Task, index: int) -> str:
    """Format a task for display in choice lists"""
    checklist_info = ""
    if task.has_checklist:
        completed, total = task.checklist_progress
        checklist_info = f" ({completed}/{total})"

    return f"{index}. {task.title}{checklist_info}"


def print_separator(char: str = "—", length: int = 50) -> None:
    """Print a visual separator"""
    console.print(char * length, style="bright_black")


def print_success(message: str) -> None:
    """Print a success message"""
    console.print(f"[bright_green]✓[/bright_green] {message}")


def print_error(message: str) -> None:
    """Print an error message"""
    console.print(f"[bright_red]✗[/bright_red] {message}")


def print_info(message: str) -> None:
    """Print an info message"""
    console.print(f"[bright_blue]ℹ[/bright_blue] {message}")


def print_warning(message: str) -> None:
    """Print a warning message"""
    console.print(f"[bright_yellow]⚠[/bright_yellow] {message}")


def pause(prompt: str = "\nPress ENTER to continue...") -> None:
    """Pause execution and wait for user input"""
    console.print(prompt, style="dim", end="")
    input()


def clear_screen() -> None:
    """Clear the console screen"""
    os.system("cls" if os.name == "nt" else "clear")


def get_task_number(prompt: str, max_value: int) -> Optional[int]:
    """Get a valid task number from user"""
    from questionary import text

    while True:
        try:
            value = text(prompt).ask()
            if not value:
                return None
            num = int(value)
            if 1 <= num <= max_value:
                return num
            console.print(f"[bright_red]Please enter a number between 1 and {max_value}[/bright_red]")
        except ValueError:
            console.print("[bright_red]Please enter a valid number[/bright_red]")
        except KeyboardInterrupt:
            return None


def sort_tasks_for_tree(tasks: List[Task]) -> List[Task]:
    """Sort tasks by due_date (ascending) then priority, with critical tasks last.

    Tasks without due_date appear at the end.
    Critical tasks (priority 1, 🔴) appear last within their group for better visibility.

    Args:
        tasks: List of tasks to sort

    Returns:
        Sorted list of tasks
    """
    def sort_key(task):
        # Tasks with due_date come first (sort_key=0)
        # Tasks without due_date come last (sort_key=1)
        # CRITICAL: Priority 1 tasks (🔴) should appear LAST
        # Transform priority so 1 (critical) sorts after 2,3,4
        priority_order = 999 if task.priority == 1 else task.priority

        if task.due_date:
            return (0, task.due_date, priority_order)
        else:
            return (1, "9999-12-31", priority_order)

    return sorted(tasks, key=sort_key)


def print_tree_view(
    tasks: List[Task],
    routines: List[RoutineTask],
    activities: List[str],
    show_completed: bool = True,
    show_active: bool = True
) -> None:
    """Display all items in a tree format with checklists expanded.

    Args:
        tasks: List of tasks to display
        routines: List of routines to display
        activities: List of activities to display
        show_completed: Include completed items
        show_active: Include active/incomplete items
    """
    # Create main tree
    tree = Tree("[bold cyan]All Items[/bold cyan]")

    # Split routines into pending and completed
    pending_routines = [r for r in routines if not r.is_completed_today]
    completed_routines = [r for r in routines if r.is_completed_today]

    # Add Pending Routines branch FIRST (prioritize daily habits)
    if pending_routines and show_active:
        pending_branch = tree.add("[bright_magenta]Pending Routines[/bright_magenta]")
        for routine in pending_routines:
            status = "[bright_red][TODO][/bright_red]"
            routine_label = f"{status} {routine.title}"

            # Add progress info if routine has target value
            if routine.target_value:
                routine_label += f" ({routine.current_progress}/{routine.target_value} {routine.unit or ''})"

            if routine.has_checklist:
                routine_node = pending_branch.add(routine_label)
                for item in routine.checklist:
                    item_status = "[bright_green][X][/bright_green]" if item.completed else "[bright_red][_[/bright_red]"
                    routine_node.add(f"  {item_status} {item.description}")
            else:
                pending_branch.add(routine_label)

    # Add Tasks branch SECOND
    if tasks:
        tasks_branch = tree.add("[bright_cyan]Tasks[/bright_cyan]")

        # Priority indicators
        priority_symbols = {
            1: "🔴",
            2: "🟠",
            3: "🟡",
            4: "🟢"
        }

        from datetime import date

        # Sort tasks by due_date → priority
        sorted_tasks = sort_tasks_for_tree(tasks)

        for task in sorted_tasks:
            # Filter by completion status
            if (task.completed and not show_completed) or (not task.completed and not show_active):
                continue

            # Add task node with status and priority
            status = "[bright_green][DONE][/bright_green]" if task.completed else "[bright_red][TODO][/bright_red]"
            priority_symbol = priority_symbols.get(task.priority, "⚪")
            task_label = f"{status} {priority_symbol} {task.title}"

            # Add due date indicator if overdue
            if task.due_date and not task.completed:
                try:
                    due_date_obj = date.fromisoformat(task.due_date)
                    if due_date_obj < date.today():
                        task_label += f" [bright_red]({task.due_date})[/bright_red]"
                except ValueError:
                    pass

            if task.has_checklist:
                task_node = tasks_branch.add(task_label)
                # Add checklist items as children
                for item in task.checklist:
                    item_status = "[bright_green][X][/bright_green]" if item.completed else "[bright_red][_[/bright_red]"
                    task_node.add(f"  {item_status} {item.description}")
            else:
                tasks_branch.add(task_label)

    # Add Completed Routines branch THIRD (only if there are any)
    if completed_routines and show_completed:
        completed_branch = tree.add("[dim bright_magenta]Completed Routines[/dim bright_magenta]")
        for routine in completed_routines:
            status = "[bright_green][DONE][/bright_green]"
            routine_label = f"{status} {routine.title}"

            # Add progress info if routine has target value
            if routine.target_value:
                routine_label += f" ({routine.current_progress}/{routine.target_value} {routine.unit or ''})"

            if routine.has_checklist:
                routine_node = completed_branch.add(routine_label)
                for item in routine.checklist:
                    item_status = "[bright_green][X][/bright_green]" if item.completed else "[bright_red][_[/bright_red]"
                    routine_node.add(f"  {item_status} {item.description}")
            else:
                completed_branch.add(routine_label)

    # Add Activities branch LAST
    if activities:
        activities_branch = tree.add("[bright_yellow]Activities[/bright_yellow]")
        for activity in activities:
            activities_branch.add(f"  • {activity}")

    # Print the tree
    console.print(tree)


def print_tree_for_selection(tasks: List[Task]) -> dict[int, Task]:
    """Display tasks in tree format for selection purposes.

    Shows full task titles without truncation and returns a mapping
    of displayed numbers to actual task objects.

    Args:
        tasks: List of tasks to display

    Returns:
        Dictionary mapping displayed number to task object {number: task}
    """
    if not tasks:
        console.print(Panel("No tasks found.", border_style="bright_black"))
        return {}

    # Priority indicators
    priority_symbols = {
        1: "🔴",
        2: "🟠",
        3: "🟡",
        4: "🟢"
    }

    from datetime import date

    # Sort tasks by due_date → priority
    sorted_tasks = sort_tasks_for_tree(tasks)

    # Create mapping of displayed number to task
    task_map = {}

    console.print("\n[bold cyan]Select a Task:[/bold cyan]\n")

    for i, task in enumerate(sorted_tasks, 1):
        # Map displayed number to task
        task_map[i] = task

        # Build task label
        status = "[bright_green]✓[/bright_green]" if task.completed else "[bright_red]○[/bright_red]"
        priority_symbol = priority_symbols.get(task.priority, "⚪")

        # Show full title (no truncation)
        task_label = f"[bright_cyan]{i}.[/bright_cyan] {status} {priority_symbol} {task.title}"

        # Add due date if present
        if task.due_date:
            try:
                due_date_obj = date.fromisoformat(task.due_date)
                if due_date_obj < date.today() and not task.completed:
                    task_label += f" [bright_red]({task.due_date})[/bright_red]"
                else:
                    task_label += f" [dim]({task.due_date})[/dim]"
            except ValueError:
                task_label += f" [dim]({task.due_date})[/dim]"

        # Add checklist progress if available
        if task.has_checklist:
            completed, total = task.checklist_progress
            task_label += f" [bright_green]({completed}/{total})[/bright_green]"

        console.print(task_label)

        # Show checklist items if task has checklist
        if task.has_checklist:
            for item in task.checklist:
                item_status = "[bright_green]  [X][/bright_green]" if item.completed else "[bright_red]  [_[/bright_red]"
                console.print(f"{item_status} {item.description}")

    # Add back option
    console.print(f"\n[bright_yellow]0. 🔙 Voltar[/bright_yellow]\n")

    return task_map
