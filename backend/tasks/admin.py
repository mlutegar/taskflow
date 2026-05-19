from django.contrib import admin
from .models import Task, ChecklistItem, Routine, RoutineChecklistItem


class ChecklistItemInline(admin.TabularInline):
    model = ChecklistItem
    extra = 0


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ["title", "priority", "completed", "due_date", "created_at"]
    list_filter = ["completed", "priority"]
    inlines = [ChecklistItemInline]


@admin.register(ChecklistItem)
class ChecklistItemAdmin(admin.ModelAdmin):
    list_display = ["description", "task", "completed"]


class RoutineChecklistItemInline(admin.TabularInline):
    model = RoutineChecklistItem
    extra = 0


@admin.register(Routine)
class RoutineAdmin(admin.ModelAdmin):
    list_display = ["title", "target_value", "unit", "current_progress", "last_completed_date"]
    inlines = [RoutineChecklistItemInline]
