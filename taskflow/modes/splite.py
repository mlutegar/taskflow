"""Splite Mode - Progressive cycles with chosen activity"""

import random
from datetime import date, timedelta
from typing import List
from taskflow.modes.base import BaseMode
from taskflow.utils import (
    console, print_header, print_separator,
    pause, clear_screen, print_task_list
)


class SpliteMode(BaseMode):
    """Splite Mode: Choose an activity and do progressive cycles like TikTok Mode"""

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
        super().__init__(storage)
        self.activities = self._load_activities()
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
        from questionary import select

        console.print("\n[bold_cyan]🎯 Choose Your Activity:[/bold_cyan]\n")

        # Create choices with activity names
        choices = [{"name": activity, "value": activity} for activity in self.activities]

        result = select("Select an activity:", choices=choices).ask()

        if result is None:
            return None

        return result

    def run(self) -> None:
        """Execute Splite Mode"""
        clear_screen()
        print_header("🔪 Splite Mode")
        console.print("")
        console.print("[brightcyan]How it works:[/brightcyan]")
        console.print("  1. Choose an activity from the list")
        console.print("  2. Do progressive cycles with your activity")
        console.print("")
        console.print("  [bright_yellow]Cycle 1:[/bright_yellow] Do activity 1x → Do 1 task")
        console.print("  [bright_yellow]Cycle 2:[/bright_yellow] Do activity 2x → Do 2 tasks")
        console.print("  [bright_yellow]Cycle 3:[/bright_yellow] Do activity 3x → Do 3 tasks")
        console.print("  And so on... (n × activity → n tasks)")
        console.print("")

        print_separator("—", 40)

        # Choose activity
        self.chosen_activity = self._choose_activity()

        if self.chosen_activity is None:
            console.print("\n[bright_yellow]No activity selected. Exiting Splite Mode.[/bright_yellow]")
            pause()
            return

        console.print(f"\n[bold_green]✓ Activity chosen:[/bold_green] {self.chosen_activity}")
        console.print("\n[bright_yellow]Let's begin![/bright_yellow]\n")

        # Check if there are enough tasks
        active_tasks = self.get_active_tasks()
        if len(active_tasks) < 1:
            console.print("[bright_red]You need at least 1 active task![/bright_red]")
            pause()
            return

        # Start the cycle loop
        cycle = 1
        continue_mode = True

        while continue_mode:
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
                        continue_mode = False
                        break
                elif result['action'] == 'complete_task':
                    if result['task']:
                        self.complete_task(result['task'])
                elif result['action'] == 'complete_routine':
                    if result['routine']:
                        self._complete_routine(result['routine'])
                else:  # add_task ou add_checklist
                    # Já adicionou/salvou, conta como atividade completa do ciclo
                    from taskflow.utils import print_success
                    print_success("✓ Atividade registrada! Continuando...")
                    continue

            # Ask if user wants to continue
            if continue_mode:
                console.print("\n")
                print_separator("—", 40)

                if len(self.get_active_tasks()) == 0:
                    console.print("\n[bright_green]🎉 All tasks completed![/bright_green]")
                    break

                choice = console.input(
                    "[bright_cyan]Continue to next cycle? (y/n):[/bright_cyan] "
                ).lower()

                if choice != "y":
                    continue_mode = False
                else:
                    cycle += 1

        # Show session summary
        console.print("\n")
        self.show_session_summary()
        pause()
