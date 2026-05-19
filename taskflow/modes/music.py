"""Music Doing Mode - Pass through 100 songs on Spotify"""

from taskflow.modes.base import BaseMode
from taskflow.utils import (
    console, print_header, print_separator, print_info,
    pause, clear_screen
)


class MusicMode(BaseMode):
    """Music Doing Mode: Go through 100 songs to find one, then do a task"""

    def run(self) -> None:
        """Execute Music Doing Mode"""
        clear_screen()
        print_header("🎵 Music Doing Mode")
        console.print("")
        console.print("[brightcyan]How it works:[/brightcyan]")
        console.print("  1. Go to Spotify")
        console.print("  2. Skip through songs until you find one you like")
        console.print("  3. When you find THE song, come back here")
        console.print("  4. Select a task to do while listening to it")
        console.print("")

        # Continue music mode loop
        continue_mode = True

        while continue_mode:
            print_separator("—", 40)

            console.print("\n[bright_yellow]🎧 Go to Spotify and pass through ~100 songs[/bright_yellow]")
            console.print("[dim]When you find a song that resonates, press ENTER below[/dim]\n")

            pause("Press ENTER when you've found your song... ")

            console.print("\n[bright_green]🎵 Great! Now let's pick a task to do with this song[/bright_green]\n")

            result = self.select_task_with_management()

            if result['action'] == 'cancel':
                console.print("[bright_yellow]No task selected. Exiting Music Mode.[/bright_yellow]")
                pause()
                return
            elif result['action'] == 'complete_task':
                if result['task']:
                    console.print(f"\n[bold_cyan]Task: {result['task'].title}[/bold_cyan]\n")

                    if result['task'].description:
                        console.print(f"[dim]{result['task'].description}[/dim]\n")

                    if result['task'].has_checklist:
                        console.print("[bright_cyan]Checklist:[/bright_cyan]")
                        for i, item in enumerate(result['task'].checklist, 1):
                            status = "[bright_green]✓[/bright_green]" if item.completed else "[bright_red]○[/bright_red]"
                            console.print(f"  {status} {i}. {item.description}")
                        console.print("")

                    console.print("[bright_yellow]🎧 Play your song and do the task![/bright_yellow]")
                    pause("\nPress ENTER when you've completed the task... ")

                    # Complete the task
                    self.complete_task(result['task'])
            elif result['action'] == 'complete_routine':
                if result['routine']:
                    self._complete_routine(result['routine'])
            else:  # add_task ou add_checklist
                # Já adicionou/salvou
                from taskflow.utils import print_success
                console.print("\n[bright_green]✓ Great! Song registered, task added![/bright_green]")
                self.tasks_completed += 1

            # Ask if user wants to continue
            console.print("\n")
            print_separator("—", 40)

            if len(self.get_active_tasks()) == 0:
                console.print("\n[bright_green]🎉 All tasks completed![/bright_green]")
                break

            choice = console.input(
                "[bright_cyan]Continue with another song/task? (y/n):[/bright_cyan] "
            ).lower()

            if choice != "y":
                continue_mode = False

        # Show session summary (only when exiting)
        console.print("\n")
        self.show_session_summary()
        pause()
