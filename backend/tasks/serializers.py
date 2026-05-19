from rest_framework import serializers
from .models import Task, ChecklistItem, Routine, RoutineChecklistItem


class ChecklistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChecklistItem
        fields = ["id", "description", "completed", "order"]


class TaskSerializer(serializers.ModelSerializer):
    checklist = ChecklistItemSerializer(many=True, read_only=True)
    checklist_count = serializers.SerializerMethodField()
    checklist_completed_count = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            "id", "title", "description", "completed",
            "created_at", "priority", "due_date",
            "checklist", "checklist_count", "checklist_completed_count",
        ]
        read_only_fields = ["id", "created_at"]

    def get_checklist_count(self, obj):
        return obj.checklist.count()

    def get_checklist_completed_count(self, obj):
        return obj.checklist.filter(completed=True).count()


class TaskCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = ["title", "description", "priority", "due_date"]


# --- Routines ---

class RoutineChecklistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoutineChecklistItem
        fields = ["id", "description", "completed", "order"]


class RoutineSerializer(serializers.ModelSerializer):
    checklist = RoutineChecklistItemSerializer(many=True, read_only=True)
    is_completed_today = serializers.SerializerMethodField()
    progress_percentage = serializers.SerializerMethodField()
    checklist_count = serializers.SerializerMethodField()
    checklist_completed_count = serializers.SerializerMethodField()

    class Meta:
        model = Routine
        fields = [
            "id", "title", "description", "target_value", "unit",
            "current_progress", "last_completed_date", "completion_history",
            "created_at", "checklist", "is_completed_today",
            "progress_percentage", "checklist_count", "checklist_completed_count",
        ]
        read_only_fields = ["id", "created_at", "current_progress", "last_completed_date", "completion_history"]

    def get_is_completed_today(self, obj):
        return obj.is_completed_today

    def get_progress_percentage(self, obj):
        return obj.progress_percentage

    def get_checklist_count(self, obj):
        return obj.checklist.count()

    def get_checklist_completed_count(self, obj):
        return obj.checklist.filter(completed=True).count()


class RoutineCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Routine
        fields = ["title", "description", "target_value", "unit"]
