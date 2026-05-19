"""Momentum Mode - Break inertia with 5-minute focused sessions"""

from questionary import select
from taskflow.modes.base import BaseMode
from taskflow.utils import (
    console, print_header, print_separator, print_info,
    pause, clear_screen, print_task_detail
)
from taskflow.timer import countdown_timer


class MomentumMode(BaseMode):
    """Momentum Mode: 5-minute focused sessions to break inertia"""

    def run(self) -> None:
        """Execute Momentum Mode"""
        clear_screen()
        print_header("⚡ Momentum Mode")
        console.print("")
        console.print("[brightcyan]How it works:[/brightcyan]")
        console.print("  1. Confirm your phone is away")
        console.print("  2. Select a task to work on")
        console.print("  3. Focus for 5 minutes (with visual timer)")
        console.print("  4. Minimum effort - just start!")
        console.print("  5. After timer: continue or stop")
        console.print("")

        print_separator("—", 40)

        # Step 1: Phone confirmation
        if not self._confirm_phone_away():
            console.print("\n[bright_yellow]Put your phone away and try again.[/bright_yellow]")
            pause()
            return

        console.print("\n[bold_green]✓ Phone confirmed away![/bold_green]\n")

        # Step 2: Task selection
        result = self.select_task_with_management()

        if result['action'] == 'cancel':
            console.print("[bright_yellow]No task selected. Exiting Momentum Mode.[/bright_yellow]")
            pause()
            return
        elif result['action'] == 'complete_task':
            if result['task']:
                self._run_momentum_cycle(result['task'])
        elif result['action'] == 'complete_routine':
            if result['routine']:
                self._complete_routine(result['routine'])
        else:  # add_task ou add_checklist
            from taskflow.utils import print_success
            console.print("\n[bold_green]✓ Task added! You can do it![/bold_green]")
            self.tasks_completed += 1

        # Show session summary
        self.show_session_summary()
        pause()

    def _confirm_phone_away(self) -> bool:
        """Confirm that phone is away"""
        from questionary import confirm

        console.print("\n[bold_yellow]📱 Phone Check:[/bold_yellow]\n")
        console.print("[dim]Is your phone in another room or turned off?[/dim]")
        console.print("[dim]This is crucial for breaking inertia![/dim]\n")

        confirmed = confirm(
            "I confirm my phone is away and I won't check it",
            default=False
        ).ask()

        return confirmed

    def _run_momentum_cycle(self, task) -> None:
        """Run a momentum cycle with the selected task"""
        # Show task details
        print_task_detail(task)

        console.print("\n[bold_cyan]⚡ Momentum Mindset:[/bold_cyan]")
        console.print("[dim]The goal isn't perfection - it's STARTING.[/dim]")
        console.print("[dim]Do the minimum possible. Just begin.[/dim]\n")

        pause("Press ENTER when you're ready to start the 5-minute timer... ")

        # Start the timer
        console.print("\n")
        timer_completed = countdown_timer(
            seconds=300,  # 5 minutes
            title=f"⚡ Focus: {task.title[:30]}"
        )

        if not timer_completed:
            console.print("\n[bright_yellow]Timer was cancelled. That's okay![/bright_yellow]")
            console.print("[dim]Remember: showing up is what matters.[/dim]")
            return

        # Post-timer options
        self._handle_post_timer(task)

    def _handle_post_timer(self, task) -> None:
        """Handle what happens after the timer completes"""
        from questionary import select
        from taskflow.utils import print_success

        console.print("\n")
        print_separator("—", 40)
        console.print("\n[bold_green]✓ Great job! You did it![/bold_green]\n")

        # If task has checklist, ask about it
        if task.has_checklist:
            completed, total = task.checklist_progress
            console.print(f"[dim]Checklist progress: {completed}/{total} items[/dim]\n")

        choices = [
            {"name": "🔄 Continue for another 5 minutes", "value": "continue"},
            {"name": "📋 Manage checklist", "value": "checklist"} if task.has_checklist else None,
            {"name": "✅ Mark task as completed", "value": "complete"},
            {"name": "🔙 Stop (I made progress!)", "value": "stop"},
        ]

        # Remove None values
        choices = [c for c in choices if c is not None]

        action = select("What would you like to do now?", choices=choices).ask()

        if action == "continue":
            console.print("\n[bold_green]✓ Let's keep the momentum going![/bold_green]\n")
            pause("Press ENTER when you're ready for another 5 minutes... ")
            console.print("\n")
            timer_completed = countdown_timer(
                seconds=300,
                title=f"⚡ Focus: {task.title[:30]}"
            )

            if timer_completed:
                self._handle_post_timer(task)
            else:
                console.print("\n[dim]You showed up and that's what matters![/dim]")

        elif action == "checklist":
            # Manage checklist
            checklist_completed = self._manage_checklist(task)
            if checklist_completed:
                print_success("Checklist 100% complete! Amazing work!")
                self.tasks_completed += 1
            else:
                # Ask if wants to continue or stop
                self._handle_post_timer(task)

        elif action == "complete":
            # Mark task as completed
            if task.has_checklist:
                completed, total = task.checklist_progress
                if completed < total:
                    force_complete = select(
                        f"Only {completed}/{total} checklist items done. Complete anyway?",
                        choices=[
                            {"name": "Yes, complete it", "value": True},
                            {"name": "No, go back", "value": False},
                        ]
                    ).ask()

                    if not force_complete:
                        self._handle_post_timer(task)
                        return

            task.mark_completed()
            self.storage.update_task(task)
            print_success(f"Task '{task.title}' completed!")
            self.tasks_completed += 1

        elif action == "stop" or action is None:
            console.print("\n[bold_green]✓ You made progress![/bold_green]")
            console.print("[dim]That momentum will carry over to next time![/dim]")
