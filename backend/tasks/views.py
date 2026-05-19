from datetime import date
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from .models import Task, ChecklistItem, Routine, RoutineChecklistItem
from .serializers import (
    TaskSerializer, TaskCreateSerializer, ChecklistItemSerializer,
    RoutineSerializer, RoutineCreateSerializer, RoutineChecklistItemSerializer,
)


class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.prefetch_related("checklist").all()

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return TaskCreateSerializer
        return TaskSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        if status_filter == "active":
            qs = qs.filter(completed=False)
        elif status_filter == "completed":
            qs = qs.filter(completed=True)
        sort_by = self.request.query_params.get("sort", "priority")
        if sort_by == "due_date":
            qs = qs.order_by("due_date", "priority")
        elif sort_by == "created":
            qs = qs.order_by("-created_at")
        else:
            qs = qs.order_by("priority", "-created_at")
        return qs

    def create(self, request, *args, **kwargs):
        serializer = TaskCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task = serializer.save()
        return Response(TaskSerializer(task).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = TaskCreateSerializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        task = serializer.save()
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        task = self.get_object()
        task.completed = True
        task.save()
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"])
    def reopen(self, request, pk=None):
        task = self.get_object()
        task.completed = False
        task.save()
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"], url_path="checklist")
    def add_checklist_item(self, request, pk=None):
        task = self.get_object()
        description = request.data.get("description", "").strip()
        if not description:
            return Response({"error": "description is required"}, status=status.HTTP_400_BAD_REQUEST)
        order = task.checklist.count()
        item = ChecklistItem.objects.create(task=task, description=description, order=order)
        return Response(ChecklistItemSerializer(item).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch", "delete"], url_path=r"checklist/(?P<item_id>\d+)")
    def checklist_item(self, request, pk=None, item_id=None):
        task = self.get_object()
        item = get_object_or_404(ChecklistItem, id=item_id, task=task)

        if request.method == "DELETE":
            item.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        item.completed = not item.completed
        item.save()
        return Response(ChecklistItemSerializer(item).data)


class RoutineViewSet(viewsets.ModelViewSet):
    queryset = Routine.objects.prefetch_related("checklist").all()

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return RoutineCreateSerializer
        return RoutineSerializer

    def _reset_and_serialize(self, routine):
        routine.ensure_daily_reset()
        return routine

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        status_filter = request.query_params.get("status")
        routines = [self._reset_and_serialize(r) for r in qs]
        if status_filter == "pending":
            routines = [r for r in routines if not r.is_completed_today]
        elif status_filter == "done":
            routines = [r for r in routines if r.is_completed_today]
        return Response(RoutineSerializer(routines, many=True).data)

    def retrieve(self, request, *args, **kwargs):
        routine = self.get_object()
        self._reset_and_serialize(routine)
        return Response(RoutineSerializer(routine).data)

    def create(self, request, *args, **kwargs):
        serializer = RoutineCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        routine = serializer.save()
        return Response(RoutineSerializer(routine).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = RoutineCreateSerializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        routine = serializer.save()
        return Response(RoutineSerializer(routine).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        routine = self.get_object()
        today = date.today()
        routine.last_completed_date = today
        history = list(routine.completion_history)
        if today.isoformat() not in history:
            history.append(today.isoformat())
        routine.completion_history = history
        if routine.target_value:
            routine.current_progress = routine.target_value
        routine.save()
        routine.checklist.update(completed=True)
        return Response(RoutineSerializer(routine).data)

    @action(detail=True, methods=["post"])
    def uncomplete(self, request, pk=None):
        routine = self.get_object()
        today = date.today().isoformat()
        history = [d for d in routine.completion_history if d != today]
        routine.completion_history = history
        routine.last_completed_date = date.fromisoformat(history[-1]) if history else None
        if routine.target_value:
            routine.current_progress = 0.0
        routine.save()
        routine.checklist.update(completed=False)
        return Response(RoutineSerializer(routine).data)

    @action(detail=True, methods=["post"], url_path="complete_for_date")
    def complete_for_date(self, request, pk=None):
        routine = self.get_object()
        date_str = request.data.get("date")
        if not date_str:
            return Response({"error": "date is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            target_date = date.fromisoformat(date_str)
        except ValueError:
            return Response({"error": "Invalid date format, use YYYY-MM-DD"}, status=status.HTTP_400_BAD_REQUEST)
        if target_date > date.today():
            return Response({"error": "Cannot mark as done for a future date"}, status=status.HTTP_400_BAD_REQUEST)

        history = list(routine.completion_history)
        if target_date.isoformat() not in history:
            history.append(target_date.isoformat())
            history.sort()
            routine.completion_history = history
            if routine.last_completed_date is None or target_date > routine.last_completed_date:
                routine.last_completed_date = target_date
            routine.save()
        return Response(RoutineSerializer(routine).data)

    @action(detail=True, methods=["post"], url_path="add_progress")
    def add_progress(self, request, pk=None):
        routine = self.get_object()
        self._reset_and_serialize(routine)

        if not routine.target_value:
            return Response({"error": "Routine has no target value"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            amount = float(request.data.get("amount", 0))
        except (ValueError, TypeError):
            return Response({"error": "amount must be a number"}, status=status.HTTP_400_BAD_REQUEST)

        routine.current_progress = min(routine.target_value, routine.current_progress + amount)

        if routine.current_progress >= routine.target_value:
            today = date.today()
            routine.last_completed_date = today
            history = list(routine.completion_history)
            if today.isoformat() not in history:
                history.append(today.isoformat())
            routine.completion_history = history

        routine.save()
        return Response(RoutineSerializer(routine).data)

    @action(detail=True, methods=["post"], url_path="checklist")
    def add_checklist_item(self, request, pk=None):
        routine = self.get_object()
        description = request.data.get("description", "").strip()
        if not description:
            return Response({"error": "description is required"}, status=status.HTTP_400_BAD_REQUEST)
        order = routine.checklist.count()
        item = RoutineChecklistItem.objects.create(routine=routine, description=description, order=order)
        return Response(RoutineChecklistItemSerializer(item).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch", "delete"], url_path=r"checklist/(?P<item_id>\d+)")
    def checklist_item(self, request, pk=None, item_id=None):
        routine = self.get_object()
        item = get_object_or_404(RoutineChecklistItem, id=item_id, routine=routine)

        if request.method == "DELETE":
            item.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        item.completed = not item.completed
        item.save()

        # Auto-complete se todos os itens do checklist foram marcados
        if routine.checklist.count() > 0 and not routine.checklist.filter(completed=False).exists():
            today = date.today()
            if not routine.is_completed_today:
                routine.last_completed_date = today
                history = list(routine.completion_history)
                if today.isoformat() not in history:
                    history.append(today.isoformat())
                routine.completion_history = history
                routine.save()

        return Response(RoutineChecklistItemSerializer(item).data)
