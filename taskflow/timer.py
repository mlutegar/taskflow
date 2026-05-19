"""Timer utilities for TaskFlow modes"""

import time
from rich.console import Console
from rich.live import Live
from rich.text import Text
from rich.panel import Panel

from taskflow.utils import create_console

console = create_console()


def countdown_timer(seconds: int, title: str = "Focus Time") -> bool:
    """
    Display a visual countdown timer.

    Args:
        seconds: Number of seconds to count down
        title: Title to display above the timer

    Returns:
        True if timer completed, False if interrupted
    """
    start_time = time.time()
    end_time = start_time + seconds

    try:
        with Live(console=console, refresh_per_second=10) as live:
            while True:
                current_time = time.time()
                remaining = end_time - current_time

                if remaining <= 0:
                    # Timer completed
                    time_display = Text("05:00", style="bold bright_green")
                    message = Text("Time's up! Great job!", style="bold bright_green")
                    panel = Panel(
                        f"[bold cyan]{title}[/bold cyan]\n\n{time_display}\n\n{message}",
                        border_style="bright_green",
                        padding=(1, 3)
                    )
                    live.update(panel)
                    time.sleep(2)  # Show completion message
                    return True

                # Format time as MM:SS
                minutes = int(remaining // 60)
                secs = int(remaining % 60)
                time_str = f"{minutes:02d}:{secs:02d}"

                # Create visual display
                time_text = Text(time_str, style="bold bright_yellow")
                progress_pct = (seconds - remaining) / seconds

                progress_bar = Text(
                    "█" * int(progress_pct * 30) + "░" * (30 - int(progress_pct * 30)),
                    style="bright_cyan"
                )

                panel = Panel(
                    f"[bold cyan]{title}[/bold cyan]\n\n"
                    f"[bold white]{time_text}[/bold white]\n\n"
                    f"{progress_bar}\n\n"
                    f"[dim]Press Ctrl+C to cancel[/dim]",
                    border_style="bright_blue",
                    padding=(1, 3)
                )

                live.update(panel)
                time.sleep(0.1)

    except KeyboardInterrupt:
        console.print("\n[bright_yellow]Timer cancelled.[/bright_yellow]")
        return False
