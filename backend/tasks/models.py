import uuid
from datetime import date
from django.db import models


class Task(models.Model):
    PRIORITY_CHOICES = [
        (1, "Crítica"),
        (2, "Alta"),
        (3, "Média"),
        (4, "Baixa"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    priority = models.IntegerField(choices=PRIORITY_CHOICES, default=4)
    due_date = models.DateField(blank=True, null=True)

    class Meta:
        ordering = ["priority", "-created_at"]

    def __str__(self):
        return self.title


class ChecklistItem(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="checklist")
    description = models.CharField(max_length=500)
    completed = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.description


class Routine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    target_value = models.FloatField(blank=True, null=True)
    unit = models.CharField(max_length=50, blank=True, null=True)
    current_progress = models.FloatField(default=0.0)
    last_completed_date = models.DateField(blank=True, null=True)
    completion_history = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["title"]

    def __str__(self):
        return self.title

    @property
    def is_completed_today(self):
        return self.last_completed_date == date.today()

    @property
    def progress_percentage(self):
        if not self.target_value:
            return None
        return min(100.0, (self.current_progress / self.target_value) * 100.0)

    def ensure_daily_reset(self):
        """Reset progress and checklist if last completion was on a previous day."""
        today = date.today()
        if self.last_completed_date and self.last_completed_date < today:
            if self.current_progress > 0:
                self.current_progress = 0.0
                Routine.objects.filter(pk=self.pk).update(current_progress=0.0)
            self.checklist.filter(completed=True).update(completed=False)


class RoutineChecklistItem(models.Model):
    routine = models.ForeignKey(Routine, on_delete=models.CASCADE, related_name="checklist")
    description = models.CharField(max_length=500)
    completed = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.description
