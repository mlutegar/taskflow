from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TaskViewSet, RoutineViewSet

router = DefaultRouter()
router.register("tasks", TaskViewSet, basename="task")
router.register("routines", RoutineViewSet, basename="routine")

urlpatterns = [
    path("", include(router.urls)),
]
