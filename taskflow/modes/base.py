"""Base class for execution modes"""

from abc import ABC, abstractmethod
from typing import List, Optional
from taskflow.models import Task, RoutineTask
from taskflow.storage import TaskStorage, RoutineStorage
from taskflow.utils import console, print_info, print_success, pause, print_task_list, print_tree_view, print_tree_for_selection


class BaseMode(ABC):
    """Abstract base class for execution modes"""

    def __init__(self, storage: TaskStorage):
        self.storage = storage
        self.routine_storage = RoutineStorage()
        self.tasks_completed = 0

    @abstractmethod
    def run(self) -> None:
        """Execute the mode"""
        pass

    def get_active_tasks(self) -> List[Task]:
        """Get list of active tasks"""
        return self.storage.get_active_tasks()

    def select_task(self, tasks: Optional[List[Task]] = None) -> Optional[Task]:
        """Let user select a task from the list"""
        if tasks is None:
            tasks = self.get_active_tasks()

        if not tasks:
            console.print("[bright_red]No active tasks available![/bright_red]")
            console.print("[bright_yellow]Add some tasks first in the task management menu.[/bright_yellow]")
            pause()
            return None

        print_task_list(tasks, "Select a Task", show_back_option=True)
        console.print("")

        while True:
            try:
                choice = console.input("Enter task number (or 0 to go back): ")
                if not choice:
                    continue
                num = int(choice)
                if num == 0:
                    return None
                if 1 <= num <= len(tasks):
                    return tasks[num - 1]
                console.print(f"[bright_red]Please enter a number between 0 and {len(tasks)}[/bright_red]")
            except ValueError:
                console.print("[bright_red]Please enter a valid number[/bright_red]")
            except KeyboardInterrupt:
                return None

    def select_task_with_management(self, tasks: Optional[List[Task]] = None) -> dict:
        """
        Permite selecionar tarefa, rotina ou gerenciar tarefas.

        Retorna:
            {
                'action': 'complete_task' | 'complete_routine' | 'add_task' | 'add_checklist' | 'cancel',
                'task': Task | None,
                'routine': RoutineTask | None
            }
        """
        from questionary import select

        if tasks is None:
            tasks = self.get_active_tasks()

        choices = []

        # Opção 1: Concluir tarefa existente
        if tasks:
            choices.append({"name": "✅ Concluir tarefa existente", "value": "complete_task"})

        # Opção 2: Concluir rotina do dia
        choices.append({"name": "📅 Concluir rotina do dia", "value": "complete_routine"})

        # Opção 3: Adicionar nova tarefa
        choices.append({"name": "➕ Adicionar nova tarefa", "value": "add_task"})

        # Opção 4: Adicionar checklist
        if tasks:
            choices.append({"name": "📋 Adicionar checklist a tarefa", "value": "add_checklist"})

        # Opção 5: Ver todos os itens juntos
        choices.append({"name": "🔍 Ver todos os itens juntos", "value": "view_all"})

        # Opção 6: Cancelar
        choices.append({"name": "🚪 Cancelar", "value": "cancel"})

        action = select("O que você quer fazer?", choices=choices).ask()

        if action == "complete_task":
            # Mostrar tarefas e selecionar
            task = self._select_task_from_list(tasks)
            return {'action': 'complete_task', 'task': task, 'routine': None}

        elif action == "complete_routine":
            # Selecionar rotina pendente
            routine = self._select_routine_to_complete()
            return {'action': 'complete_routine', 'task': None, 'routine': routine}

        elif action == "add_task":
            # Adicionar nova tarefa
            task = self._add_new_task_interactive()
            if task:
                return {'action': 'add_task', 'task': task, 'routine': None}
            else:
                # Se cancelou, volta para o menu
                return self.select_task_with_management(tasks)

        elif action == "add_checklist":
            # Adicionar checklist
            task = self._add_checklist_interactive(tasks)
            if task:
                return {'action': 'add_checklist', 'task': task, 'routine': None}
            else:
                # Se cancelou, volta para o menu
                return self.select_task_with_management(tasks)

        elif action == "view_all":
            # Ver todos os itens juntos
            self._view_all_items_interactive()
            # Volta para o menu após visualizar
            return self.select_task_with_management(tasks)

        else:  # cancel
            return {'action': 'cancel', 'task': None, 'routine': None}

    def handle_cancellation_in_cycle(self) -> bool:
        """
        Handle task cancellation during a cycle.

        Returns:
            True if user wants to return to task selection
            False if user wants to exit the mode completely
        """
        from questionary import select

        console.print("\n[bright_yellow]⚠️ Tarefa cancelada.[/bright_yellow]\n")

        choices = [
            {"name": "1. → Escolher outra tarefa/ação", "value": "return"},
            {"name": "2. → Sair do modo", "value": "exit"},
        ]

        action = select("O que você quer fazer agora?", choices=choices).ask()

        return action == "return"

    def _select_task_from_list(self, tasks: List[Task]) -> Optional[Task]:
        """Mostra lista de tarefas e permite selecionar.

        Exibe apenas tarefas ativas (não concluídas) em formato de árvore,
        expandindo automaticamente as subtarefas (checklist) de cada tarefa.
        """
        if not tasks:
            console.print("[bright_red]No active tasks available![/bright_red]")
            return None

        # Mostrar apenas tarefas ativas (não concluídas)
        display_tasks = [t for t in tasks if not t.completed]

        if not display_tasks:
            console.print("[bright_yellow]Todas as tarefas estão concluídas![/bright_yellow]")
            return None

        # Sempre usar a árvore com subtarefas expandidas
        task_map = print_tree_for_selection(display_tasks)
        console.print("")

        while True:
            try:
                choice = console.input("Enter task number (or 0 to go back): ")
                if not choice:
                    continue
                num = int(choice)
                if num == 0:
                    return None
                if num in task_map:
                    return task_map[num]
                console.print(f"[bright_red]Please enter a number between 0 and {len(task_map)}[/bright_red]")
            except ValueError:
                console.print("[bright_red]Please enter a valid number[/bright_red]")
            except KeyboardInterrupt:
                return None

    def _add_new_task_interactive(self) -> Optional[Task]:
        """Adiciona nova tarefa de forma interativa"""
        from questionary import text, select, confirm
        from taskflow.utils import print_success

        console.print("\n[bold_cyan]Adicionar Nova Tarefa[/bold_cyan]\n")

        title = text("Título da tarefa:").ask()
        if not title or not title.strip():
            console.print("[bright_yellow]Título é obrigatório![/bright_yellow]")
            return None

        description = text("Descrição (opcional):").ask() or None

        # Priority (optional)
        priority = 4  # default Baixa
        set_priority = confirm("Definir prioridade?", default=False).ask()
        if set_priority:
            priority_choices = [
                {"name": "🔴 Crítica", "value": 1},
                {"name": "🟠 Alta", "value": 2},
                {"name": "🟡 Média", "value": 3},
                {"name": "🟢 Baixa", "value": 4},
            ]
            priority = select("Prioridade:", choices=priority_choices).ask()
            if priority is None:
                priority = 4  # fallback to default if cancelled

        # Due date (optional)
        due_date = None
        set_due = confirm("Definir data limite?", default=False).ask()
        if set_due:
            due_date = text("Data limite (YYYY-MM-DD):").ask()
            if not due_date or len(due_date) != 10:
                due_date = None

        task = Task.create(
            title=title.strip(),
            description=description,
            priority=priority,
            due_date=due_date
        )
        self.storage.add_task(task)

        console.print(f"\n[bold_green]✓ Tarefa '{title}' adicionada![/bold_green]")

        return task

    def _add_checklist_interactive(self, tasks: List[Task]) -> Optional[Task]:
        """Adiciona checklist a uma tarefa existente"""
        if not tasks:
            console.print("[bright_red]Nenhuma tarefa encontrada![/bright_red]")
            return None

        console.print("\n[bold_cyan]Adicionar Checklist a Tarefa[/bold_cyan]\n")

        # Filter to show only active tasks (not completed)
        display_tasks = [t for t in tasks if not t.completed]

        if not display_tasks:
            console.print("[bright_yellow]Todas as tarefas estão completas![/bright_yellow]")
            return None

        # Use tree mode for task selection
        task_map = print_tree_for_selection(display_tasks)

        # Get numeric input
        task_num_input = console.input("Digite o número da tarefa (ou 0 para voltar): ")

        if not task_num_input or not task_num_input.strip():
            return None

        try:
            task_num = int(task_num_input.strip())
            if task_num == 0:
                return None
            if task_num in task_map:
                task = task_map[task_num]
            else:
                console.print("[bright_red]Número de tarefa inválido![/bright_red]")
                pause()
                return None
        except ValueError:
            console.print("[bright_red]Por favor, digite um número válido![/bright_red]")
            pause()
            return None

        # Adicionar itens do checklist
        console.print(f"\n[bold_cyan]Adicionando checklist a: {task.title}[/bold_cyan]")
        console.print("[dim]Pressione ENTER com texto vazio para finalizar[/dim]\n")

        while True:
            item_text = console.input(f"Item {len(task.checklist) + 1}: ")

            if not item_text or item_text.strip() == "":
                break

            task.add_checklist_item(item_text.strip())
            print_success(f"Adicionado: {item_text.strip()}")

        if task.checklist:
            self.storage.update_task(task)
            console.print(f"\n[bold_green]✓ Checklist com {len(task.checklist)} itens adicionado a '{task.title}'![/bold_green]")
            return task
        else:
            console.print("[bright_yellow]Nenhum item adicionado.[/bright_yellow]")
            return None

    def _select_routine_to_complete(self) -> Optional[RoutineTask]:
        """Seleciona uma rotina pendente para completar"""
        from questionary import select

        pending_routines = self.routine_storage.get_pending_routines()

        if not pending_routines:
            console.print("\n[bold_yellow]Nenhuma rotina pendente hoje![/bold_yellow]")
            console.print("[dim]Todas as rotinas já foram completadas![/dim]\n")
            pause()
            return None

        # Mostrar rotinas pendentes
        console.print("\n[bold_cyan]Rotinas Pendentes (Hoje):[/bold_cyan]\n")

        for i, routine in enumerate(pending_routines, 1):
            target_display = ""
            if routine.target_value:
                target_display = f" ({routine.current_progress}/{routine.target_value} {routine.unit or ''})"

            console.print(f"  [bright_cyan]{i}.[/bright_cyan] {routine.title}{target_display}")

        console.print("")

        # Selecionar rotina
        routine_choices = [
            {"name": f"{i+1}. {r.title}", "value": r}
            for i, r in enumerate(pending_routines)
        ]
        routine_choices.append({"name": "Voltar", "value": None})

        selected = select("Selecione uma rotina para completar:", choices=routine_choices).ask()

        if selected is None:
            return None

        return selected

    def _complete_routine(self, routine: RoutineTask) -> None:
        """Completa uma rotina (atualiza progresso ou marca como completa)"""
        from taskflow.utils import print_success, print_info, print_error
        from questionary import select

        console.print(f"\n[bold_cyan]Rotina: {routine.title}[/bold_cyan]\n")

        if routine.description:
            console.print(f"[dim]{routine.description}[/dim]\n")

        if routine.target_value:
            # Rotina com valor alvo
            console.print(f"[bright_cyan]Progresso atual: {routine.get_status_display()}[/bright_cyan]\n")

            choices = [
                {"name": "Adicionar ao progresso", "value": "add_progress"},
                {"name": "Marcar como completa", "value": "complete"},
                {"name": "Cancelar", "value": "cancel"},
            ]

            action = select("O que você quer fazer?", choices=choices).ask()

            if action == "add_progress":
                amount_input = console.input(
                    f"Quanto adicionar? (atual: {routine.current_progress}/{routine.target_value} {routine.unit or ''}) "
                )

                try:
                    amount = float(amount_input)
                    routine.update_progress(amount)
                    self.routine_storage.update_routine(routine)

                    if routine.is_completed_today:
                        print_success(f"Rotina '{routine.title}' completada!")
                        self.tasks_completed += 1
                    else:
                        print_success(f"Progresso atualizado: {routine.get_status_display()}")
                except ValueError:
                    print_error("Valor inválido!")

            elif action == "complete":
                routine.mark_completed()
                self.routine_storage.update_routine(routine)
                print_success(f"Rotina '{routine.title}' marcada como completa!")
                self.tasks_completed += 1

        else:
            # Rotina simples (sem valor alvo)
            if routine.has_checklist:
                # Usar o sistema de checklist
                self._manage_routine_checklist(routine)
            else:
                routine.mark_completed()
                self.routine_storage.update_routine(routine)
                print_success(f"Rotina '{routine.title}' completada!")
                self.tasks_completed += 1

    def _manage_routine_checklist(self, routine: RoutineTask) -> None:
        """Gerencia checklist de uma rotina"""
        from questionary import select
        from taskflow.utils import print_success

        while True:
            console.print(f"\n[bold_cyan]Checklist: {routine.title}[/bold_cyan]\n")

            # Mostrar checklist com status
            for i, item in enumerate(routine.checklist, 1):
                status = "[bright_green]✓[/bright_green]" if item.completed else "[bright_red]○[/bright_red]"
                console.print(f"  {status} {i}. {item.description}")

            completed, total = routine.checklist_progress
            console.print(f"\n[dim]Progress: {completed}/{total} completos[/dim]\n")

            # Perguntar o que fazer
            choices = [
                {"name": "✅ Marcar/desmarcar item", "value": "toggle"},
                {"name": "✓ Finalizar", "value": "finish"},
            ]

            action = select("O que você quer fazer?", choices=choices).ask()

            if action == "toggle":
                # Selecionar item para marcar/desmarcar
                item_choices = [
                    {"name": f"{i+1}. {item.description}", "value": i}
                    for i, item in enumerate(routine.checklist)
                ]
                item_choices.append({"name": "🔙 Voltar", "value": -1})

                item_index = select("Selecione um item:", choices=item_choices).ask()

                if item_index is not None and item_index >= 0:
                    routine.toggle_checklist_item(item_index)
                    self.routine_storage.update_routine(routine)
                    new_status = "marcado" if routine.checklist[item_index].completed else "desmarcado"
                    print_success(f"Item {new_status}!")

            elif action == "finish" or action is None:
                # Verificar se todos estão completos
                all_done = all(item.completed for item in routine.checklist)
                if all_done:
                    routine.mark_completed()
                    self.routine_storage.update_routine(routine)
                    print_success(f"Rotina '{routine.title}' completada!")
                    self.tasks_completed += 1
                else:
                    # Salva progresso
                    self.routine_storage.update_routine(routine)
                    print_info(f"Progresso salvo. Continue depois!")
                break

    def _manage_checklist(self, task: Task) -> bool:
        """Permite marcar/desmarcar qualquer item do checklist livremente.

        O usuário escolhe qual subtarefa quer concluir — sem ordem forçada.

        Returns:
            True se o checklist foi 100% completado e conta como tarefa concluída para o ciclo
            False se apenas finalizou o gerenciamento sem completar tudo
        """
        from questionary import select
        from taskflow.utils import print_success, print_info

        while True:
            # Mostrar visão geral do checklist
            completed, total = task.checklist_progress
            console.print(f"\n[bold_cyan]Checklist: {task.title}[/bold_cyan]")
            console.print(f"[dim]Progresso: {completed}/{total} itens completos[/dim]\n")

            for i, item in enumerate(task.checklist, 1):
                status = "[bright_green]✓[/bright_green]" if item.completed else "[bright_red]○[/bright_red]"
                console.print(f"  {status} {i}. {item.description}")

            console.print("")

            # Verificar se todos estão completos
            all_done = completed == total

            if all_done:
                print_success("🎉 Checklist 100% completo!")
                choices = [
                    {"name": "✅ Contar como tarefa concluída (ciclo)", "value": "finish_and_count"},
                    {"name": "🔙 Voltar", "value": "back"},
                ]
                action = select("", choices=choices).ask()

                if action == "finish_and_count":
                    print_success("Contando como tarefa concluída para o ciclo!")
                    self.tasks_completed += 1
                    return True
                return False

            # Montar menu de seleção livre — qualquer subtarefa pode ser escolhida
            item_choices = []
            for i, item in enumerate(task.checklist):
                status = "✓" if item.completed else "○"
                label = f"{status} {i + 1}. {item.description}"
                item_choices.append({"name": label, "value": i})

            item_choices.append({"name": "💾 Salvar e sair", "value": "exit"})

            selected = select("Selecione a subtarefa para marcar/desmarcar (qualquer ordem):", choices=item_choices).ask()

            if selected == "exit" or selected is None:
                self.storage.update_task(task)
                completed_now, _ = task.checklist_progress
                print_info(f"Progresso salvo: {completed_now}/{total} itens completos.")
                return False

            # Marcar ou desmarcar o item selecionado
            task.toggle_checklist_item(selected)
            self.storage.update_task(task)
            completed_now, _ = task.checklist_progress
            item_name = task.checklist[selected].description
            new_status = "concluído ✓" if task.checklist[selected].completed else "desmarcado ○"
            print_success(f"'{item_name}' → {new_status}  ({completed_now}/{total})")

    def complete_task(self, task: Task) -> bool:
        """Handle task completion with improved checklist support"""
        from taskflow.utils import print_task_detail, print_success
        from questionary import select

        # Mostrar detalhes da tarefa
        print_task_detail(task)

        if task.has_checklist:
            console.print("\n[bright_cyan]Esta tarefa tem um checklist.[/bright_cyan]")

            while True:
                choices = [
                    {"name": "📋 Gerenciar checklist", "value": "checklist"},
                    {"name": "✅ Completar tarefa", "value": "complete"},
                    {"name": "🔙 Voltar", "value": "back"},
                ]

                action = select("O que você quer fazer?", choices=choices).ask()

                if action == "checklist":
                    checklist_completed = self._manage_checklist(task)
                    if checklist_completed:
                        # Checklist foi 100% completado e já conta como tarefa concluída
                        return True
                elif action == "complete":
                    # Verificar se todos os itens estão completos
                    completed, total = task.checklist_progress
                    all_done = completed == total

                    if all_done:
                        task.mark_completed()
                        self.storage.update_task(task)
                        print_success(f"Tarefa '{task.title}' completada!")
                        self.tasks_completed += 1
                        self._show_tree_after_completion()
                        return True
                    else:
                        # Perguntar se quer completar mesmo assim
                        force_complete = select(
                            f"Apenas {completed}/{total} itens completos. Completar mesmo assim?",
                            choices=[
                                {"name": "Sim, completar", "value": True},
                                {"name": "Não, voltar", "value": False},
                            ]
                        ).ask()

                        if force_complete:
                            task.mark_completed()
                            self.storage.update_task(task)
                            print_success(f"Tarefa '{task.title}' completada!")
                            self.tasks_completed += 1
                            self._show_tree_after_completion()
                            return True
                elif action == "back" or action is None:
                    from taskflow.utils import print_info
                    print_info("Voltando ao menu anterior...")
                    return False
        else:
            # Tarefa simples sem checklist
            task.mark_completed()
            self.storage.update_task(task)
            print_success(f"Tarefa '{task.title}' completada!")
            self.tasks_completed += 1
            self._show_tree_after_completion()
            return True

    def _show_tree_after_completion(self) -> None:
        """Mostra as tarefas no formato tree após concluir uma tarefa"""
        from taskflow.modes.splite import SpliteMode

        # Carregar todos os dados
        all_tasks = self.storage.load_tasks()
        all_routines = self.routine_storage.get_all_routines()

        # Carregar atividades usando SpliteMode
        mode = SpliteMode(self.storage)
        all_activities = mode.activities

        # Mostrar tree view
        console.print("\n")
        print_tree_view(
            tasks=all_tasks,
            routines=all_routines,
            activities=all_activities,
            show_completed=True,
            show_active=True
        )

    def _view_all_items_interactive(self) -> None:
        """Mostra todos os itens (tarefas, rotinas, atividades) em formato de árvore"""
        from questionary import select
        from taskflow.modes.splite import SpliteMode
        from taskflow.utils import clear_screen, print_header

        # Ask for filter preference
        filter_choice = select(
            "Quais itens você gostaria de ver?",
            choices=[
                {"name": "Mostrar Todos", "value": "all"},
                {"name": "Mostrar Apenas Pendentes", "value": "active"},
                {"name": "Mostrar Apenas Completados", "value": "completed"},
                {"name": "Cancelar", "value": None},
            ]
        ).ask()

        if filter_choice is None:
            return

        # Load all data
        all_tasks = self.storage.load_tasks()
        all_routines = self.routine_storage.get_all_routines()

        # Load activities using SpliteMode's method
        mode = SpliteMode(self.storage)
        all_activities = mode.activities

        # Apply filter
        show_completed = filter_choice in ["all", "completed"]
        show_active = filter_choice in ["all", "active"]

        # Clear screen and display
        clear_screen()
        print_header("Todos os Itens - Vista em Árvore")
        console.print("")

        print_tree_view(
            tasks=all_tasks,
            routines=all_routines,
            activities=all_activities,
            show_completed=show_completed,
            show_active=show_active
        )

        console.print(f"\n[dim]Total: {len(all_tasks)} tarefas, {len(all_routines)} rotinas, {len(all_activities)} atividades[/dim]")
        pause()

    def show_session_summary(self) -> None:
        """Show summary of the session"""
        from taskflow.utils import print_separator, print_success

        print_separator()
        if self.tasks_completed > 0:
            print_success(f"Session complete! Tasks completed: {self.tasks_completed}")
        else:
            print_info("Session complete. No tasks were completed.")
        print_separator()
