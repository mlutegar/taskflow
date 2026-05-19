"""Espresso Sprint Mode - High-intensity 25-minute sprints powered by caffeine"""

from questionary import select, confirm
from taskflow.modes.base import BaseMode
from taskflow.utils import (
    console, print_header, print_separator, print_info,
    pause, clear_screen, print_task_detail
)
from taskflow.timer import countdown_timer


class EspressoSprintMode(BaseMode):
    """Espresso Sprint Mode: 25-minute focused sprints with coffee tracking"""

    def __init__(self, storage):
        super().__init__(storage)
        self.coffees_consumed = 0
        self.sprints_completed = 0

    def run(self) -> None:
        """Execute Espresso Sprint Mode"""
        clear_screen()
        print_header("☕ Espresso Sprint Mode")
        console.print("")
        console.print("[brightcyan]How it works:[/brightcyan]")
        console.print("  1. Confirm you've had coffee (we'll track it)")
        console.print("  2. Select a task to work on")
        console.print("  3. Sprint for 25 minutes (powered by caffeine!)")
        console.print("  4. After sprint: continue with/without coffee, or stop")
        console.print("  5. We recommend max 4-6 sprints per session")
        console.print("")

        print_separator("—", 40)

        # Step 1: Coffee confirmation
        if not self._confirm_coffee():
            console.print("\n[bright_yellow]No coffee, no sprint! Grab a cup first.[/bright_yellow]")
            pause()
            return

        console.print(f"\n[bold_green]✓ Coffee confirmed! ({self.coffees_consumed} cup(s) this session)[/bold_green]\n")

        # Step 2: Task selection
        result = self.select_task_with_management()

        if result['action'] == 'cancel':
            console.print("[bright_yellow]No task selected. Exiting Espresso Sprint Mode.[/bright_yellow]")
            pause()
            return
        elif result['action'] == 'complete_task':
            if result['task']:
                self._run_espresso_sprint(result['task'])
        elif result['action'] == 'complete_routine':
            if result['routine']:
                self._complete_routine(result['routine'])
        else:  # add_task ou add_checklist
            from taskflow.utils import print_success
            console.print("\n[bold_green]✓ Task added! Time to sprint![/bold_green]")
            self.tasks_completed += 1

        # Show session summary
        self._show_session_summary()
        pause()

    def _confirm_coffee(self) -> bool:
        """Confirm that user has had coffee"""
        console.print("\n[bold_yellow]☕ Coffee Check:[/bold_yellow]\n")
        console.print("[dim]Have you had coffee to fuel your sprint?[/dim]")
        console.print("[dim]We'll track your consumption during this session.[/dim]\n")

        had_coffee = confirm(
            "Yes, I've had coffee (or about to have one)",
            default=True
        ).ask()

        if had_coffee:
            self.coffees_consumed += 1

        return had_coffee

    def _run_espresso_sprint(self, task) -> None:
        """Run an espresso sprint with the selected task"""
        # Show task details
        print_task_detail(task)

        console.print(f"\n[bold_cyan]☕ Espresso Sprint #{self.sprints_completed + 1}[/bold_cyan]")
        console.print(f"[dim]Coffees this session: {self.coffees_consumed}[/dim]")
        console.print("[dim]High intensity, focused work![/dim]\n")

        pause("Press ENTER when you're ready to start the 25-minute sprint... ")

        # Start the timer
        console.print("\n")
        timer_completed = countdown_timer(
            seconds=1500,  # 25 minutes
            title=f"☕ Sprint: {task.title[:30]}"
        )

        if not timer_completed:
            console.print("\n[bright_yellow]Sprint was cancelled. That's okay![/bright_yellow]")
            console.print("[dim]Remember: quality over quantity![/dim]")
            return

        # Post-sprint options
        self.sprints_completed += 1
        self._handle_post_sprint(task)

    def _handle_post_sprint(self, task) -> None:
        """Handle what happens after the sprint completes"""
        from questionary import select
        from taskflow.utils import print_success

        console.print("\n")
        print_separator("—", 40)
        console.print(f"\n[bold_green]✓ Sprint {self.sprints_completed} complete![/bold_green]")
        console.print(f"[dim]Coffees consumed: {self.coffees_consumed}[/dim]")

        # Caffeine check
        if self.sprints_completed >= 4:
            console.print("\n[bright_yellow]⚠️ Caffeine Advisory:[/bright_yellow]")
            console.print(f"[dim]You've completed {self.sprints_completed} sprints.[/dim]")
            console.print("[dim]Consider taking a break or stopping soon![/dim]\n")

        # If task has checklist, show progress
        if task.has_checklist:
            completed, total = task.checklist_progress
            console.print(f"[dim]Checklist progress: {completed}/{total} items[/dim]\n")

        choices = [
            {"name": "☕ Continue with another coffee", "value": "continue_with_coffee"},
            {"name": "⚡ Continue without coffee", "value": "continue_without_coffee"},
            {"name": "📋 Manage checklist", "value": "checklist"} if task.has_checklist else None,
            {"name": "✅ Mark task as completed", "value": "complete"},
            {"name": "🔙 Stop (Great sprint!)", "value": "stop"},
        ]

        # Remove None values
        choices = [c for c in choices if c is not None]

        action = select("What would you like to do now?", choices=choices).ask()

        if action == "continue_with_coffee":
            console.print("\n[bold_yellow]☕ Fueling up for another sprint![/bold_yellow]\n")

            # Confirm coffee consumption
            if confirm("Confirm you're having another coffee?", default=True).ask():
                self.coffees_consumed += 1
                console.print(f"[bold_green]✓ Noted! Total: {self.coffees_consumed} coffee(s)[/bold_green]\n")

            pause("Press ENTER when ready for the next 25-minute sprint... ")
            console.print("\n")
            timer_completed = countdown_timer(
                seconds=1500,
                title=f"☕ Sprint: {task.title[:30]}"
            )

            if timer_completed:
                self.sprints_completed += 1
                self._handle_post_sprint(task)
            else:
                console.print("\n[dim]Great effort! See you next time![/dim]")

        elif action == "continue_without_coffee":
            console.print("\n[bold_green]✓ Let's keep sprinting caffeine-free![/bold_green]\n")
            pause("Press ENTER when you're ready for the next 25-minute sprint... ")
            console.print("\n")
            timer_completed = countdown_timer(
                seconds=1500,
                title=f"⚡ Sprint: {task.title[:30]}"
            )

            if timer_completed:
                self.sprints_completed += 1
                self._handle_post_sprint(task)
            else:
                console.print("\n[dim]Great effort! See you next time![/dim]")

        elif action == "checklist":
            # Manage checklist
            checklist_completed = self._manage_checklist(task)
            if checklist_completed:
                print_success("Checklist 100% complete! Amazing work!")
                self.tasks_completed += 1
            else:
                # Ask if wants to continue or stop
                self._handle_post_sprint(task)

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
                        self._handle_post_sprint(task)
                        return

            task.mark_completed()
            self.storage.update_task(task)
            print_success(f"Task '{task.title}' completed!")
            self.tasks_completed += 1

        elif action == "stop" or action is None:
            console.print("\n[bold_green]✓ Excellent sprinting![/bold_green]")
            console.print(f"[dim]Sprints completed: {self.sprints_completed}[/dim]")
            console.print(f"[dim]Coffees consumed: {self.coffees_consumed}[/dim]")
            console.print("[dim]That caffeine-powered momentum was great![/dim]")

    def _show_session_summary(self) -> None:
        """Show enhanced session summary with coffee stats"""
        from taskflow.utils import print_separator, print_success, print_info

        print_separator()
        if self.tasks_completed > 0:
            print_success(f"Session complete! Tasks: {self.tasks_completed}")
        else:
            print_info("Session complete. No tasks were completed.")

        # Coffee stats
        console.print(f"\n[bold_cyan]☕ Session Stats:[/bold_cyan]")
        console.print(f"  Sprints completed: [bright_green]{self.sprints_completed}[/bright_green]")
        console.print(f"  Coffees consumed: [bright_yellow]{self.coffees_consumed}[/bright_yellow]")

        if self.sprints_completed > 0:
            efficiency = f"{(self.sprints_completed * 25)} min"
            console.print(f"  Total focus time: [bright_cyan]{efficiency}[/bright_cyan]")

        print_separator()
