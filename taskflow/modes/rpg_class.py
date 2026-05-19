"""RPG Class Mode - Gamified productivity with character classes"""

import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any
from questionary import select, text, confirm
from taskflow.modes.base import BaseMode
from taskflow.utils import (
    console, print_header, print_separator, print_info,
    print_success, pause, clear_screen, print_task_detail,
    print_tree_view
)
from taskflow.timer import countdown_timer


# ============== CONFIGURAÇÕES DO SISTEMA ==============

# Tabela de níveis e XP necessário
LEVEL_REQUIREMENTS = {
    1: (0, "Novice"),
    2: (100, "Apprentice"),
    3: (250, "Adept"),
    4: (500, "Expert"),
    5: (1000, "Master"),
    6: (2000, "Grandmaster"),
    7: (5000, "Legend"),
}

# Configurações das classes
CLASS_CONFIG = {
    "warrior": {
        "name": "Warrior",
        "emoji": "⚔️",
        "description": "Mestre em tarefas difíceis e trabalho físico. Bônus de stamina e resistência.",
        "focus_time": 30,  # minutos
        "color": "bright_red",
        "bonuses": {
            "stamina_bonus": 1.15,  # +15% tempo de foco
            "consecutive_bonus": 3,  # Após 3 tarefas consecutivas
            "focus_extension": 5,  # +5 minutos de foco (Second Wind)
        }
    },
    "mage": {
        "name": "Mage",
        "emoji": "🧙‍♂️",
        "description": "Especialista em tarefas criativas e estudo. Bônus de XP intelectual.",
        "focus_time": 25,  # minutos
        "color": "bright_blue",
        "bonuses": {
            "xp_multiplier": 1.25,  # +25% XP em tarefas de estudo
            "mana_regen": 10,  # Cada 10min regenera mana
            "spell_efficiency": 1.2,  # +20% eficácia em ferramentas de foco
        }
    },
    "rogue": {
        "name": "Rogue",
        "emoji": "🗡️",
        "description": "Especialista em tarefas rápidas e organização. Bônus de velocidade.",
        "focus_time": 15,  # minutos (mais curto)
        "color": "bright_green",
        "bonuses": {
            "speed_multiplier": 1.5,  # +50% XP em tarefas < 15min
            "combo_requirement": 5,  # 5 tarefas rápidas em sequência
            "critical_strike": 2.0,  # 2x XP no combo
        }
    }
}

# Habilidades de cada classe
CLASS_SKILLS = {
    "warrior": [
        {
            "name": "Berserker Rage",
            "description": "30min de foco intenso (não pode parar), depois ×2 XP nas próximas 2 tarefas",
            "level_required": 1,
            "cooldown": 0,  # em minutos, 0 = sem cooldown
            "charges": 2,  # quantas vezes pode usar
        },
        {
            "name": "Shield Wall",
            "description": "Ativa modo 'não perturbe' por 1 hora",
            "level_required": 3,
            "cooldown": 120,
            "charges": 1,
        }
    ],
    "mage": [
        {
            "name": "Time Warp",
            "description": "Transforma 1 hora em 1.5h de tempo produtivo (sessão especial)",
            "level_required": 1,
            "cooldown": 0,
            "charges": 2,
        },
        {
            "name": "Arcane Focus",
            "description": "Aumenta concentração por 45min com cooldown de 2 horas",
            "level_required": 3,
            "cooldown": 120,
            "charges": 1,
        }
    ],
    "rogue": [
        {
            "name": "Vanish",
            "description": "Some todas notificações por 25min (sessão stealth)",
            "level_required": 1,
            "cooldown": 0,
            "charges": 3,
        },
        {
            "name": "Pickpocket",
            "description": "Completa tarefa antiga com bônus de XP",
            "level_required": 2,
            "cooldown": 60,
            "charges": 2,
        }
    ]
}

# Conquistas (Achievements)
ACHIEVEMENTS = {
    "first_blood": {"name": "First Blood", "description": "Primeira tarefa completada", "emoji": "🩸"},
    "combo_master": {"name": "Combo Master", "description": "10 tarefas consecutivas", "emoji": "🔥"},
    "speed_demon": {"name": "Speed Demon", "description": "5 tarefas em 1 hora", "emoji": "⚡"},
    "wisdom_seeker": {"name": "Wisdom Seeker", "description": "10 tarefas de estudo", "emoji": "📚"},
    "unbreakable": {"name": "Unbreakable", "description": "3 sessões de 2h+", "emoji": "💎"},
    "level_master": {"name": "Level Master", "description": "Atingiu nível 5 (Master)", "emoji": "👑"},
    "legendary": {"name": "Legendary", "description": "Atingiu nível 7 (Legend)", "emoji": "🌟"},
}

# Multiplicadores de dificuldade de tarefa
DIFFICULTY_MULTIPLIERS = {
    "easy": 0.5,
    "medium": 1.0,
    "hard": 2.0,
    "very_hard": 3.0,
}


# ============== CLASSE RPGCharacter ==============

class RPGCharacter:
    """Gerencia o personagem e progresso do jogador"""

    def __init__(self, save_file: str = "data/rpg_save.json"):
        self.save_file = save_file
        self.data: Dict[str, Any] = {}
        self.exists = os.path.exists(save_file)
        if self.exists:
            self.load_data()

    def create_character(self, class_type: str, character_name: str) -> None:
        """Cria um novo personagem"""
        self.data = {
            "character": {
                "name": character_name,
                "class": class_type,
                "level": 1,
                "xp": 0,
                "created_at": datetime.now().isoformat(),
                "total_tasks": 0,
                "total_focus_time": 0,  # em minutos
                "consecutive_tasks": 0,
                "max_consecutive": 0,
            },
            "stats": {
                class_type: {
                    "skills_used": {},
                    "special_abilities_activated": 0,
                }
            },
            "achievements": [],
            "skills_unlocked": self._get_starting_skills(class_type),
            "history": [],
            "last_played": datetime.now().isoformat(),
        }
        self.save_data()

    def load_data(self) -> None:
        """Carrega os dados do arquivo"""
        try:
            with open(self.save_file, 'r', encoding='utf-8') as f:
                self.data = json.load(f)
        except Exception as e:
            console.print(f"[bright_red]Erro ao carregar personagem: {e}[/bright_red]")
            self.exists = False

    def save_data(self) -> None:
        """Salva os dados no arquivo"""
        try:
            # Criar diretório se não existir (apenas se houver um diretório no caminho)
            dir_path = os.path.dirname(self.save_file)
            if dir_path:  # Só cria se houver um diretório no caminho
                os.makedirs(dir_path, exist_ok=True)

            self.data["last_played"] = datetime.now().isoformat()
            with open(self.save_file, 'w', encoding='utf-8') as f:
                json.dump(self.data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            console.print(f"[bright_red]Erro ao salvar personagem: {e}[/bright_red]")

    def _get_starting_skills(self, class_type: str) -> List[str]:
        """Retorna habilidades desbloqueadas no nível 1"""
        skills = CLASS_SKILLS.get(class_type, [])
        return [s["name"] for s in skills if s["level_required"] == 1]

    def get_class_info(self) -> Dict:
        """Retorna informações da classe do personagem"""
        class_type = self.data["character"]["class"]
        return CLASS_CONFIG[class_type]

    def get_available_skills(self) -> List[Dict]:
        """Retorna habilidades disponíveis para o nível atual"""
        class_type = self.data["character"]["class"]
        level = self.data["character"]["level"]
        all_skills = CLASS_SKILLS.get(class_type, [])
        return [s for s in all_skills if s["level_required"] <= level]

    def gain_xp(self, amount: int, task_title: str, task_difficulty: str = "medium") -> bool:
        """
        Adiciona XP ao personagem.
        Retorna True se subiu de nível.
        """
        character = self.data["character"]
        class_type = character["class"]

        # Aplicar multiplicador de dificuldade
        base_xp = amount * DIFFICULTY_MULTIPLIERS.get(task_difficulty, 1.0)

        # Aplicar bônus de classe
        class_bonus = self._calculate_class_bonus(base_xp, task_difficulty)
        total_xp = int(base_xp + class_bonus)

        # Adicionar XP
        old_level = character["level"]
        character["xp"] += total_xp
        character["total_tasks"] += 1
        character["consecutive_tasks"] += 1
        character["max_consecutive"] = max(
            character["max_consecutive"],
            character["consecutive_tasks"]
        )

        # Adicionar ao histórico
        self.data["history"].insert(0, {
            "date": datetime.now().isoformat(),
            "task": task_title,
            "xp_gained": total_xp,
            "difficulty": task_difficulty,
            "level_after": character["level"],
        })

        # Manter apenas últimos 50 históricos
        if len(self.data["history"]) > 50:
            self.data["history"] = self.data["history"][:50]

        # Verificar level up
        new_level = self._calculate_level(character["xp"])
        leveled_up = False

        if new_level > old_level:
            character["level"] = new_level
            leveled_up = True
            self._unlock_skills_for_level(new_level)

        # Verificar conquistas
        self._check_achievements()

        self.save_data()
        return leveled_up

    def _calculate_class_bonus(self, base_xp: float, task_difficulty: str) -> float:
        """Calcula bônus de XP baseado na classe"""
        character = self.data["character"]
        class_type = character["class"]
        class_config = CLASS_CONFIG[class_type]

        bonus = 0

        if class_type == "mage" and task_difficulty in ["medium", "hard"]:
            # Wisdom bônus para tarefas de estudo
            bonus = base_xp * (class_config["bonuses"]["xp_multiplier"] - 1.0)

        elif class_type == "rogue" and task_difficulty == "easy":
            # Speed bônus para tarefas rápidas
            bonus = base_xp * (class_config["bonuses"]["speed_multiplier"] - 1.0)

        return bonus

    def _calculate_level(self, xp: int) -> int:
        """Calcula o nível baseado no XP"""
        level = 1
        for lvl, (xp_req, _) in LEVEL_REQUIREMENTS.items():
            if xp >= xp_req:
                level = lvl
            else:
                break
        return level

    def _unlock_skills_for_level(self, level: int) -> None:
        """Desbloqueia habilidades para o nível"""
        class_type = self.data["character"]["class"]
        all_skills = CLASS_SKILLS.get(class_type, [])

        for skill in all_skills:
            if skill["level_required"] == level:
                if skill["name"] not in self.data["skills_unlocked"]:
                    self.data["skills_unlocked"].append(skill["name"])

    def _check_achievements(self) -> None:
        """Verifica e desbloqueia conquistas"""
        character = self.data["character"]

        # First Blood
        if character["total_tasks"] >= 1:
            self._unlock_achievement("first_blood")

        # Combo Master
        if character["consecutive_tasks"] >= 10:
            self._unlock_achievement("combo_master")

        # Level Master
        if character["level"] >= 5:
            self._unlock_achievement("level_master")

        # Legendary
        if character["level"] >= 7:
            self._unlock_achievement("legendary")

    def _unlock_achievement(self, achievement_id: str) -> None:
        """Desbloqueia uma conquista"""
        if achievement_id not in self.data["achievements"]:
            self.data["achievements"].append(achievement_id)

    def get_achievements(self) -> List[Dict]:
        """Retorna conquistas desbloqueadas"""
        achievements = []
        for ach_id in self.data["achievements"]:
            if ach_id in ACHIEVEMENTS:
                achievements.append(ACHIEVEMENTS[ach_id])
        return achievements

    def get_level_info(self) -> tuple:
        """Retorna (level, xp, xp_required, level_name)"""
        character = self.data["character"]
        level = character["level"]
        current_xp = character["xp"]

        # Encontrar próximo nível
        next_level = level + 1
        if next_level in LEVEL_REQUIREMENTS:
            xp_required = LEVEL_REQUIREMENTS[next_level][0]
        else:
            xp_required = current_xp  # Já está no nível máximo

        level_name = LEVEL_REQUIREMENTS[level][1]

        return level, current_xp, xp_required, level_name

    def use_skill(self, skill_name: str) -> bool:
        """Registra uso de habilidade"""
        class_type = self.data["character"]["class"]
        if skill_name not in self.data["stats"][class_type]["skills_used"]:
            self.data["stats"][class_type]["skills_used"][skill_name] = 0
        self.data["stats"][class_type]["skills_used"][skill_name] += 1
        self.data["stats"][class_type]["special_abilities_activated"] += 1
        self.save_data()
        return True

    def add_focus_time(self, minutes: int) -> None:
        """Adiciona tempo de foco total"""
        self.data["character"]["total_focus_time"] += minutes
        self.save_data()


# ============== CLASSE PRINCIPAL RPGClassMode ==============

class RPGClassMode(BaseMode):
    """Modo RPG com classes de personagem"""

    def __init__(self, storage):
        super().__init__(storage)
        self.character: Optional[RPGCharacter] = None
        self.save_file = "data/rpg_save.json"
        self.active_skill: Optional[Dict] = None
        self.tasks_in_session = []
        self.session_start_time = None

    def run(self) -> None:
        """Executa o modo RPG"""
        clear_screen()
        print_header("🎮 RPG Class Mode")

        # Carregar ou criar personagem
        self.character = RPGCharacter(self.save_file)

        if not self.character.exists:
            if not self._create_new_character():
                return

        # Dashboard principal
        self._main_dashboard()

    def _create_new_character(self) -> bool:
        """Cria um novo personagem"""
        console.print("\n[bright_cyan]Bem-vindo ao RPG Class Mode![/bright_cyan]\n")
        console.print("[dim]Crie seu personagem para começar sua jornada de produtividade.[/dim]\n")

        # Nome do personagem
        name = text("Nome do seu personagem:").ask()
        if not name or not name.strip():
            console.print("[bright_yellow]Nome é obrigatório![/bright_yellow]")
            return False

        # Seleção de classe
        console.print("\n[bright_cyan]Escolha sua classe:[/bright_cyan]\n")

        class_choices = []
        for class_key, class_info in CLASS_CONFIG.items():
            description = f"{class_info['emoji']} {class_info['name']}\n   {class_info['description']}"
            class_choices.append({
                "name": description,
                "value": class_key
            })

        selected_class = select("Qual classe chama você?", choices=class_choices).ask()

        if not selected_class:
            return False

        # Criar personagem
        self.character.create_character(selected_class, name.strip())

        # Mostrar confirmação
        class_info = CLASS_CONFIG[selected_class]
        console.print(f"\n[bold_green]✓ Personagem criado com sucesso![/bold_green]\n")
        console.print(f"[bold_{class_info['color']}] {class_info['emoji']} {name.strip()}[/bold_{class_info['color']}]")
        console.print(f"[dim]Classe: {class_info['name']}[/dim]")
        console.print(f"[dim]Nível: 1 (Novice)[/dim]\n")

        pause("Pressione ENTER para começar sua jornada... ")
        return True

    def _main_dashboard(self) -> None:
        """Dashboard principal do modo"""
        while True:
            clear_screen()
            self._show_character_status()

            choices = [
                {"name": "⚔️ Selecionar Tarefa (Start Quest)", "value": "quest"},
                {"name": "✨ Usar Habilidade", "value": "skill"},
                {"name": "🏆 Ver Conquistas", "value": "achievements"},
                {"name": "📊 Estatísticas Detalhadas", "value": "stats"},
                {"name": "🔙 Sair do Modo", "value": "exit"},
            ]

            action = select("O que você deseja fazer?", choices=choices).ask()

            if action == "quest":
                self._quest_loop()
            elif action == "skill":
                self._skill_menu()
            elif action == "achievements":
                self._show_achievements()
            elif action == "stats":
                self._show_detailed_stats()
            elif action == "exit" or action is None:
                break

    def _show_character_status(self) -> None:
        """Mostra status atual do personagem"""
        char_data = self.character.data["character"]
        class_info = self.character.get_class_info()
        level, xp, xp_req, level_name = self.character.get_level_info()

        print_header(f"{class_info['emoji']} {char_data['name']} - {class_info['name']}")

        # Barra de XP
        if level < 7:
            progress = xp / xp_req if xp_req > 0 else 1.0
            bar_length = 20
            filled = int(progress * bar_length)
            bar = "█" * filled + "░" * (bar_length - filled)
            xp_display = f"XP: {xp}/{xp_req}"
        else:
            bar = "█" * 20
            xp_display = "XP: MAX"

        console.print(f"[bold_{class_info['color']}]Level {level} ({level_name})[/bold_{class_info['color']}]")
        console.print(f"[dim]{xp_display} {bar}[/dim]\n")

        # Estatísticas rápidas
        console.print(f"[dim]Tarefas completadas: {char_data['total_tasks']}[/dim]")
        console.print(f"[dim]Combo atual: {char_data['consecutive_tasks']} (máx: {char_data['max_consecutive']})[/dim]")
        console.print(f"[dim]Tempo total de foco: {char_data['total_focus_time']} min[/dim]\n")

        # Habilidades disponíveis
        available_skills = self.character.get_available_skills()
        if available_skills:
            console.print(f"[bright_cyan]Habilidades Disponíveis:[/bright_cyan]")
            for skill in available_skills:
                console.print(f"  [dim]• {skill['name']}[/dim]")
        else:
            console.print(f"[dim]Nenhuma habilidade desbloqueada ainda.[/dim]")

        console.print("")

    def _quest_loop(self) -> None:
        """Loop de seleção e execução de tarefas (quests)"""
        result = self.select_task_with_management()

        if result['action'] == 'cancel':
            return
        elif result['action'] == 'complete_task':
            if result['task']:
                self._execute_quest(result['task'])
        elif result['action'] == 'complete_routine':
            if result['routine']:
                self._complete_routine_quest(result['routine'])
        elif result['action'] in ['add_task', 'add_checklist']:
            console.print("\n[bold_green]✓ Operação realizada![/bold_green]")
            self.tasks_completed += 1
            pause()

    def _execute_quest(self, task) -> None:
        """Executa uma tarefa como uma quest"""
        # Mostrar detalhes da tarefa e estimativa de XP
        self._show_quest_details(task)

        # Selecionar dificuldade
        difficulty = self._select_difficulty()

        if not difficulty:
            return

        # Calcular estimativa de XP
        base_xp = 10
        estimated_xp = int(base_xp * DIFFICULTY_MULTIPLIERS[difficulty])
        class_info = self.character.get_class_info()

        console.print(f"\n[dim]XP estimado: {estimated_xp} (base: {base_xp} × {DIFFICULTY_MULTIPLIERS[difficulty]})[/dim]")

        # Confirmar início da quest
        start_quest = confirm("Iniciar esta quest?").ask()

        if not start_quest:
            return

        # Executar a sessão de foco
        quest_completed = self._run_focus_session(task, difficulty)

        if quest_completed:
            # Completar tarefa e ganhar XP
            task.mark_completed()
            self.storage.update_task(task)
            print_success(f"Quest '{task.title}' completada!")

            # Ganhar XP
            leveled_up = self.character.gain_xp(base_xp, task.title, difficulty)

            # Mostrar resultado
            self._show_quest_results(leveled_up)
            self.tasks_completed += 1
        else:
            # Quest abandonada (reseta combo)
            self.character.data["character"]["consecutive_tasks"] = 0
            self.character.save_data()
            console.print("\n[bright_yellow]Quest abandonada. Combo resetado.[/bright_yellow]")

        pause()

    def _show_quest_details(self, task) -> None:
        """Mostra detalhes da quest"""
        console.print("\n[bold_cyan]═══════════════════════════════════════[/bold_cyan]")
        console.print(f"[bold_cyan]Quest: {task.title}[/bold_cyan]")
        console.print("[bold_cyan]═══════════════════════════════════════[/bold_cyan]\n")

        print_task_detail(task)

        # Informações do checklist
        if task.has_checklist:
            completed, total = task.checklist_progress
            console.print(f"\n[dim]Checklist: {completed}/{total} itens[/dim]")

        console.print("")

    def _select_difficulty(self) -> Optional[str]:
        """Permite selecionar a dificuldade da tarefa"""
        console.print("[bright_cyan]Classifique a dificuldade desta quest:[/bright_cyan]\n")

        choices = [
            {"name": "🟢 Easy (×0.5 XP) - Tarefa rápida e simples", "value": "easy"},
            {"name": "🟡 Medium (×1.0 XP) - Dificuldade padrão", "value": "medium"},
            {"name": "🟠 Hard (×2.0 XP) - Requer esforço significativo", "value": "hard"},
            {"name": "🔴 Very Hard (×3.0 XP) - Desafiador, requer foco total", "value": "very_hard"},
        ]

        difficulty = select("Dificuldade:", choices=choices).ask()
        return difficulty

    def _run_focus_session(self, task, difficulty: str) -> bool:
        """Executa a sessão de foco baseada na classe"""
        class_info = self.character.get_class_info()
        focus_minutes = class_info["focus_time"]

        console.print(f"\n[bold_{class_info['color']}]⚔️ Iniciando sessão de foco de {focus_minutes} minutos[/bold_{class_info['color']}]")
        console.print(f"[dim]Classe: {class_info['name']} | Dificuldade: {difficulty}[/dim]\n")

        pause("Pressione ENTER quando estiver pronto... ")

        # Timer de foco
        console.print("\n")
        timer_completed = countdown_timer(
            seconds=focus_minutes * 60,
            title=f"⚔️ {task.title[:40]}"
        )

        if timer_completed:
            # Adicionar tempo de foco ao personagem
            self.character.add_focus_time(focus_minutes)
            return True
        else:
            console.print("\n[bright_yellow]Timer cancelado.[/bright_yellow]")
            return False

    def _show_quest_results(self, leveled_up: bool) -> None:
        """Mostra resultados após completar uma quest"""
        console.print("\n[bold_green]╔═══════════════════════════════════════╗[/bold_green]")
        console.print("[bold_green]║       QUEST COMPLETADA!                ║[/bold_green]")
        console.print("[bold_green]╚═══════════════════════════════════════╝[/bold_green]\n")

        if leveled_up:
            level, xp, xp_req, level_name = self.character.get_level_info()
            class_info = self.character.get_class_info()
            console.print(f"[bold_{class_info['color']}]🎉 LEVEL UP! 🎉[/bold_{class_info['color']}]")
            console.print(f"[bold_{class_info['color']}]Nível {level} - {level_name}![/bold_{class_info['color']}]\n")

            # Verificar novas habilidades
            new_skills = [s for s in self.character.get_available_skills()
                         if s["level_required"] == level]
            if new_skills:
                console.print("[bright_cyan]Nova habilidade desbloqueada:[/bright_cyan]")
                for skill in new_skills:
                    console.print(f"  [bold]• {skill['name']}[/bold]")
                    console.print(f"    [dim]{skill['description']}[/dim]\n")

    def _skill_menu(self) -> None:
        """Menu de habilidades"""
        available_skills = self.character.get_available_skills()

        if not available_skills:
            console.print("\n[bright_yellow]Nenhuma habilidade desbloqueada.[/bright_yellow]")
            pause()
            return

        console.print("\n[bright_cyan]Habilidades Disponíveis:[/bright_cyan]\n")

        for skill in available_skills:
            console.print(f"[bold]• {skill['name']}[/bold]")
            console.print(f"  [dim]{skill['description']}[/dim]\n")

        skill_choices = [{"name": f"✨ {s['name']}", "value": s["name"]}
                        for s in available_skills]
        skill_choices.append({"name": "🔙 Voltar", "value": None})

        selected = select("Usar habilidade:", choices=skill_choices).ask()

        if selected:
            self._activate_skill(selected)
            pause()

    def _activate_skill(self, skill_name: str) -> None:
        """Ativa uma habilidade"""
        # Registrar uso
        self.character.use_skill(skill_name)
        print_success(f"Habilidade '{skill_name}' ativada!")

        # Efeitos específicos da habilidade
        if skill_name == "Berserker Rage":
            console.print("\n[bold_red]⚔️ BERSERKER RAGE ATIVADO! ⚔️[/bold_red]")
            console.print("[dim]Você entrará em uma sessão de 30min de foco intenso.[/dim]")
            console.print("[dim]Não pode parar! Depois ganha ×2 XP nas próximas 2 tarefas.[/dim]\n")
        elif skill_name == "Shield Wall":
            console.print("\n[bold_blue]🛡️ SHIELD WALL ATIVADO! 🛡️[/bold_blue]")
            console.print("[dim]Modo 'não perturbe' ativado por 1 hora.[/dim]\n")
        elif skill_name == "Time Warp":
            console.print("\n[bold_blue]⏰ TIME WARP ATIVADO! ⏰[/bright_blue]")
            console.print("[dim]1 hora de tempo real = 1.5h de tempo produtivo![/dim]\n")
        elif skill_name == "Arcane Focus":
            console.print("\n[bright_blue]🔮 ARCANE FOCUS ATIVADO! 🔮[/bright_blue]")
            console.print("[dim]Concentração aumentada por 45 minutos![/dim]\n")
        elif skill_name == "Vanish":
            console.print("\n[bold_green]🗡️ VANISH ATIVADO! 🗡️[/bold_green]")
            console.print("[dim]Todas notificações desativadas por 25min![/dim]\n")
        elif skill_name == "Pickpocket":
            console.print("\n[bright_green]💎 PICKPOCKET ATIVADO! 💎[/bright_green]")
            console.print("[dim]Próxima tarefa antiga completada ganha bônus de XP![/dim]\n")

    def _show_achievements(self) -> None:
        """Mostra conquistas desbloqueadas"""
        clear_screen()
        print_header("🏆 Conquistas")

        achievements = self.character.get_achievements()

        if not achievements:
            console.print("\n[dim]Nenhuma conquista desbloqueada ainda.[/dim]\n")
            console.print("[dim]Continue completando quests para desbloquear conquistas![/dim]\n")
        else:
            console.print("\n[bold_green]Conquistas Desbloqueadas:[/bold_green]\n")
            for ach in achievements:
                console.print(f"{ach['emoji']} [bold]{ach['name']}[/bold]")
                console.print(f"  [dim]{ach['description']}[/dim]\n")

        # Mostrar conquistas bloqueadas
        console.print("[bright_cyan]Conquistas Bloqueadas:[/bright_cyan]\n")
        for ach_id, ach in ACHIEVEMENTS.items():
            if ach_id not in self.character.data["achievements"]:
                console.print(f"🔒 [dim]{ach['name']}[/dim]")
                console.print(f"   [dim]{ach['description']}[/dim]\n")

        pause()

    def _show_detailed_stats(self) -> None:
        """Mostra estatísticas detalhadas"""
        clear_screen()
        print_header("📊 Estatísticas Detalhadas")

        char_data = self.character.data["character"]
        class_info = self.character.get_class_info()
        level, xp, xp_req, level_name = self.character.get_level_info()

        console.print(f"\n[bold_{class_info['color']}]Personagem:[/bold_{class_info['color']}]")
        console.print(f"  Nome: {char_data['name']}")
        console.print(f"  Classe: {class_info['name']} {class_info['emoji']}")
        console.print(f"  Nível: {level} ({level_name})")
        console.print(f"  XP: {xp}/{xp_req if level < 7 else 'MAX'}")
        console.print(f"  Criado em: {char_data['created_at'][:10]}")

        console.print(f"\n[bold_cyan]Progresso:[/bold_cyan]")
        console.print(f"  Tarefas completadas: {char_data['total_tasks']}")
        console.print(f"  Tempo total de foco: {char_data['total_focus_time']} minutos ({char_data['total_focus_time']//60}h)")
        console.print(f"  Combo atual: {char_data['consecutive_tasks']}")
        console.print(f"  Maior combo: {char_data['max_consecutive']}")

        # Habilidades usadas
        console.print(f"\n[bold_yellow]Habilidades Usadas:[/bold_yellow]")
        class_stats = self.character.data["stats"].get(char_data["class"], {})
        skills_used = class_stats.get("skills_used", {})
        if skills_used:
            for skill_name, count in skills_used.items():
                console.print(f"  {skill_name}: {count}x")
        else:
            console.print(f"  [dim]Nenhuma habilidade usada ainda.[/dim]")

        # Histórico recente
        console.print(f"\n[bright_magenta]Histórico Recente:[/bright_magenta]")
        history = self.character.data["history"][:5]
        if history:
            for h in history:
                console.print(f"  [dim]• {h['task'][:40]}[/dim] [dim]({h['xp_gained']} XP)[/dim]")
        else:
            console.print(f"  [dim]Nenhuma quest completada ainda.[/dim]")

        console.print("")
        pause()

    def _complete_routine_quest(self, routine) -> None:
        """Completa uma rotina como uma quest"""
        console.print(f"\n[bold_cyan]Rotina: {routine.title}[/bold_cyan]\n")

        if routine.description:
            console.print(f"[dim]{routine.description}[/dim]\n")

        if routine.target_value:
            console.print(f"[bright_cyan]Progresso atual: {routine.get_status_display()}[/bright_cyan]\n")

            from questionary import select as qselect

            choices = [
                {"name": "Adicionar ao progresso", "value": "add_progress"},
                {"name": "Marcar como completa", "value": "complete"},
                {"name": "Cancelar", "value": "cancel"},
            ]

            action = qselect("O que você quer fazer?", choices=choices).ask()

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
                        self.character.gain_xp(15, routine.title, "medium")
                        self.tasks_completed += 1
                    else:
                        print_success(f"Progresso atualizado: {routine.get_status_display()}")
                except ValueError:
                    console.print("[bright_red]Valor inválido![/bright_red]")

            elif action == "complete":
                routine.mark_completed()
                self.routine_storage.update_routine(routine)
                print_success(f"Rotina '{routine.title}' marcada como completa!")
                self.character.gain_xp(15, routine.title, "medium")
                self.tasks_completed += 1

        else:
            # Rotina simples
            if routine.has_checklist:
                self._manage_routine_checklist(routine)
            else:
                routine.mark_completed()
                self.routine_storage.update_routine(routine)
                print_success(f"Rotina '{routine.title}' completada!")
                self.character.gain_xp(10, routine.title, "easy")
                self.tasks_completed += 1

        pause()
