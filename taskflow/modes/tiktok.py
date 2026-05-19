"""TikTok Mode - Progressive cycles: 5 videos→1 task, 10→2, 15→3, etc."""

from typing import List, Optional
from taskflow.modes.base import BaseMode
from taskflow.utils import (
    console, print_header, print_separator, print_info,
    pause, clear_screen, print_task_list
)


class TikTokMode(BaseMode):
    """TikTok Mode: Watch videos, then do tasks in progressive cycles"""

    def run(self) -> None:
        """Execute TikTok Mode"""
        clear_screen()
        print_header("📱 TikTok Mode")
        console.print("")
        console.print("[brightcyan]How it works:[/brightcyan]")
        console.print("  Cycle 1: Watch 5 videos → Do 1 task")
        console.print("  Cycle 2: Watch 10 videos → Do 2 tasks")
        console.print("  Cycle 3: Watch 15 videos → Do 3 tasks")
        console.print("  And so on... (n × 5 videos → n tasks)")
        console.print("")

        print_separator("—", 40)

        # Check if there are enough tasks
        active_tasks = self.get_active_tasks()
        if len(active_tasks) < 1:
            console.print("[bright_red]You need at least 1 active task![/bright_red]")
            pause()
            return

        console.print("\n[bright_yellow]📱 Open TikTok and get ready![/bright_yellow]\n")

        # Start the cycle loop
        cycle = 1
        continue_mode = True

        while continue_mode:
            # Calculate videos and tasks for this cycle
            num_videos = cycle * 5
            num_tasks = cycle

            console.print(f"\n[bold_magenta]═══ Cycle {cycle} ═══[/bold_magenta]")
            console.print(f"[bright_cyan]📺 Watch {num_videos} TikTok videos[/bright_cyan]")
            console.print(f"[bright_cyan]✅ Then complete {num_tasks} task(s)[/bright_cyan]\n")

            pause("Press ENTER when you've watched the videos... ")

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
