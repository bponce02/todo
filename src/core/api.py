from datetime import date, datetime, timezone

from django.shortcuts import get_object_or_404
from ninja import Schema
from ninja.errors import HttpError
from ninja_extra import NinjaExtraAPI
from ninja_jwt.authentication import JWTAuth
from ninja_jwt.controller import NinjaJWTDefaultController
from pydantic import field_validator

from . import radicale_sync
from .models import Event, List, Task, View

api = NinjaExtraAPI()
api.register_controllers(NinjaJWTDefaultController)

auth = JWTAuth()


class ListIn(Schema):
    title: str
    view: View = View.LIST


class ListPatch(Schema):
    title: str | None = None
    view: View | None = None


class ListOut(Schema):
    id: int
    title: str
    view: View


class TaskIn(Schema):
    title: str
    list_id: int
    description: str | None = None
    completed: bool = False
    due_date: date | None = None


class TaskPatch(Schema):
    title: str | None = None
    list_id: int | None = None
    description: str | None = None
    completed: bool | None = None
    due_date: date | None = None


class TaskOut(Schema):
    id: int
    title: str
    description: str | None
    completed: bool
    due_date: date | None
    list_id: int


class EventIn(Schema):
    title: str
    list_id: int
    start: datetime
    end: datetime
    description: str | None = None
    all_day: bool = False

    @field_validator("start", "end")
    @classmethod
    def _aware(cls, v: datetime) -> datetime:
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)


class EventPatch(Schema):
    title: str | None = None
    list_id: int | None = None
    start: datetime | None = None
    end: datetime | None = None
    description: str | None = None
    all_day: bool | None = None

    @field_validator("start", "end")
    @classmethod
    def _aware(cls, v: datetime | None) -> datetime | None:
        if v is None or v.tzinfo:
            return v
        return v.replace(tzinfo=timezone.utc)


class EventOut(Schema):
    id: int
    title: str
    description: str | None
    start: datetime
    end: datetime
    all_day: bool
    list_id: int


def _check_event_times(start: datetime, end: datetime) -> None:
    if end < start:
        raise HttpError(422, "end must not be before start")


@api.get("/lists", response=list[ListOut], auth=auth)
def lists_index(request):
    return List.objects.all()


@api.post("/lists", response=ListOut, auth=auth)
def lists_create(request, payload: ListIn):
    return List.objects.create(**payload.dict())


@api.get("/lists/{list_id}", response=ListOut, auth=auth)
def lists_detail(request, list_id: int):
    return get_object_or_404(List, id=list_id)


@api.patch("/lists/{list_id}", response=ListOut, auth=auth)
def lists_update(request, list_id: int, payload: ListPatch):
    obj = get_object_or_404(List, id=list_id)
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(obj, field, value)
    obj.save()
    return obj


@api.delete("/lists/{list_id}", auth=auth)
def lists_delete(request, list_id: int):
    get_object_or_404(List, id=list_id).delete()
    return {"success": True}


@api.get("/tasks", response=list[TaskOut], auth=auth)
def tasks_index(request, list_id: int | None = None, completed: bool | None = None):
    qs = Task.objects.all()
    if list_id is not None:
        qs = qs.filter(list_id=list_id)
    if completed is not None:
        qs = qs.filter(completed=completed)
    return qs


@api.post("/tasks", response=TaskOut, auth=auth)
def tasks_create(request, payload: TaskIn):
    return Task.objects.create(**payload.dict())


@api.get("/tasks/{task_id}", response=TaskOut, auth=auth)
def tasks_detail(request, task_id: int):
    return get_object_or_404(Task, id=task_id)


@api.patch("/tasks/{task_id}", response=TaskOut, auth=auth)
def tasks_update(request, task_id: int, payload: TaskPatch):
    obj = get_object_or_404(Task, id=task_id)
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(obj, field, value)
    obj.save()
    return obj


@api.delete("/tasks/{task_id}", auth=auth)
def tasks_delete(request, task_id: int):
    get_object_or_404(Task, id=task_id).delete()
    return {"success": True}


@api.get("/events", response=list[EventOut], auth=auth)
def events_index(
    request,
    list_id: int | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
):
    qs = Event.objects.all()
    if list_id is not None:
        qs = qs.filter(list_id=list_id)
    # Range filtering is overlap-based so events spanning the window edge show.
    if start is not None:
        qs = qs.filter(end__gte=start)
    if end is not None:
        qs = qs.filter(start__lte=end)
    return qs.order_by("start")


@api.post("/events", response=EventOut, auth=auth)
def events_create(request, payload: EventIn):
    _check_event_times(payload.start, payload.end)
    return Event.objects.create(**payload.dict())


@api.get("/events/{event_id}", response=EventOut, auth=auth)
def events_detail(request, event_id: int):
    return get_object_or_404(Event, id=event_id)


@api.patch("/events/{event_id}", response=EventOut, auth=auth)
def events_update(request, event_id: int, payload: EventPatch):
    obj = get_object_or_404(Event, id=event_id)
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(obj, field, value)
    _check_event_times(obj.start, obj.end)
    obj.save()
    return obj


@api.delete("/events/{event_id}", auth=auth)
def events_delete(request, event_id: int):
    get_object_or_404(Event, id=event_id).delete()
    return {"success": True}


@api.post("/caldav/pull", auth=auth)
def caldav_pull(request):
    if not radicale_sync.is_enabled():
        return {"enabled": False, "created": 0, "updated": 0, "deleted": 0}
    counts = radicale_sync.pull()
    return {"enabled": True, **counts}
