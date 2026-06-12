from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from . import radicale_sync
from .models import Event, List, Task, View


@receiver(post_save, sender=List)
def _list_saved(sender, instance: List, created: bool, **kwargs):
    if created:
        radicale_sync.ensure_calendar(instance)
        # Calendar-view lists get their VEVENT collection eagerly so events
        # created on the phone can pull down; other lists get one lazily on
        # first event push (avoids empty calendars cluttering iOS).
        if instance.view == View.CALENDAR:
            radicale_sync.ensure_event_calendar(instance)


@receiver(post_save, sender=Task)
def _task_saved(sender, instance: Task, **kwargs):
    radicale_sync.push_task(instance)


@receiver(post_delete, sender=Task)
def _task_deleted(sender, instance: Task, **kwargs):
    radicale_sync.delete_task(instance)


@receiver(post_save, sender=Event)
def _event_saved(sender, instance: Event, **kwargs):
    radicale_sync.push_event(instance)


@receiver(post_delete, sender=Event)
def _event_deleted(sender, instance: Event, **kwargs):
    radicale_sync.delete_event(instance)
