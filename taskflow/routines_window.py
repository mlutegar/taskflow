"""Always-on-top window for displaying routine tasks"""

import tkinter as tk
from taskflow.storage import RoutineStorage


class RoutinesWindow:
    """Always-on-top window displaying routine tasks"""

    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Minhas Rotinas - TaskFlow")

        # Always on top
        self.root.attributes('-topmost', True)

        # Carregar rotinas
        self.storage = RoutineStorage()
        self.routines = self.storage.get_all_routines()

        # Criar UI
        self.setup_ui()

    def setup_ui(self):
        """Setup the user interface"""
        # Label de título
        title_label = tk.Label(
            self.root,
            text="📋 Tarefas de Rotina",
            font=("Arial", 14, "bold")
        )
        title_label.pack(pady=10)

        # Lista de rotinas
        self.listbox = tk.Listbox(
            self.root,
            font=("Arial", 11),
            height=15,
            width=50
        )
        self.listbox.pack(pady=5, padx=10)

        # Popular lista
        self.refresh_routines()

        # Botão atualizar
        refresh_btn = tk.Button(
            self.root,
            text="🔄 Atualizar",
            command=self.refresh_routines,
            font=("Arial", 10)
        )
        refresh_btn.pack(pady=10)

        # Label de info
        info_label = tk.Label(
            self.root,
            text="Always On Top - TaskFlow",
            font=("Arial", 8),
            fg="gray"
        )
        info_label.pack(pady=5)

    def refresh_routines(self):
        """Recarrega rotinas do arquivo JSON"""
        self.listbox.delete(0, tk.END)
        self.routines = self.storage.get_all_routines()

        if not self.routines:
            self.listbox.insert(tk.END, "Nenhuma rotina encontrada")
        else:
            for routine in self.routines:
                self.listbox.insert(tk.END, f"• {routine.title}")

    def run(self):
        """Inicia o loop principal da janela"""
        self.root.mainloop()


def main():
    """Função de entrada para execução direta"""
    window = RoutinesWindow()
    window.run()
