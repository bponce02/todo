from django.db import models


class View(models.TextChoices):
    LIST = "list"
    CALENDAR = "calendar"


class List(models.Model):
    title = models.CharField(max_length=255)
    view = models.CharField(max_length=255, choices=View.choices, default=View.LIST)
    remote_url = models.CharField(max_length=500, null=True, blank=True)
    remote_event_url = models.CharField(max_length=500, null=True, blank=True)

    def __str__(self):
        return self.title


class Task(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(null=True)
    completed = models.BooleanField(default=False)
    due_date = models.DateField(null=True, blank=True)
    list = models.ForeignKey(List, on_delete=models.CASCADE, related_name="tasks")
    remote_uid = models.CharField(max_length=255, null=True, blank=True)
    remote_etag = models.CharField(max_length=255, null=True, blank=True)

    def __str__(self):
        return self.title


class Event(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(null=True)
    start = models.DateTimeField()
    # Inclusive for all-day events (single-day all-day has start.date() == end.date());
    # the CalDAV layer converts to/from RFC 5545's exclusive DTEND.
    end = models.DateTimeField()
    all_day = models.BooleanField(default=False)
    list = models.ForeignKey(List, on_delete=models.CASCADE, related_name="events")
    remote_uid = models.CharField(max_length=255, null=True, blank=True)
    remote_etag = models.CharField(max_length=255, null=True, blank=True)

    def __str__(self):
        return self.title
