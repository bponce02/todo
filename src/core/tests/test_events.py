from datetime import datetime, timezone

import pytest
from icalendar import Calendar

from core.models import Event, List
from core.radicale_sync import _build_vevent, _parse_vevent

pytestmark = pytest.mark.django_db


def _dt(day: int, hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 6, day, hour, minute, tzinfo=timezone.utc)


def _make_event(list_obj, title="Meeting", start=None, end=None, **kwargs) -> Event:
    return Event.objects.create(
        title=title,
        list=list_obj,
        start=start or _dt(15, 9),
        end=end or _dt(15, 10),
        **kwargs,
    )


def test_create_event(auth_client, some_list):
    resp = auth_client.post(
        "/api/events",
        data={
            "title": "Dentist",
            "list_id": some_list.id,
            "start": "2026-06-15T09:00:00Z",
            "end": "2026-06-15T10:00:00Z",
        },
        content_type="application/json",
    )
    assert resp.status_code == 200, resp.content
    body = resp.json()
    assert body["title"] == "Dentist"
    assert body["all_day"] is False
    assert body["list_id"] == some_list.id
    assert Event.objects.filter(id=body["id"]).exists()


def test_create_all_day_event(auth_client, some_list):
    resp = auth_client.post(
        "/api/events",
        data={
            "title": "Conference",
            "list_id": some_list.id,
            "start": "2026-06-15T00:00:00Z",
            "end": "2026-06-16T00:00:00Z",
            "all_day": True,
        },
        content_type="application/json",
    )
    assert resp.status_code == 200, resp.content
    assert resp.json()["all_day"] is True


def test_create_event_rejects_end_before_start(auth_client, some_list):
    resp = auth_client.post(
        "/api/events",
        data={
            "title": "Backwards",
            "list_id": some_list.id,
            "start": "2026-06-15T10:00:00Z",
            "end": "2026-06-15T09:00:00Z",
        },
        content_type="application/json",
    )
    assert resp.status_code == 422
    assert Event.objects.count() == 0


def test_list_events_ordered_by_start(auth_client, some_list):
    _make_event(some_list, title="later", start=_dt(16, 9), end=_dt(16, 10))
    _make_event(some_list, title="earlier", start=_dt(14, 9), end=_dt(14, 10))
    resp = auth_client.get("/api/events")
    assert resp.status_code == 200
    titles = [e["title"] for e in resp.json()]
    assert titles == ["earlier", "later"]


def test_filter_events_by_list_id(auth_client, some_list):
    other = List.objects.create(title="Other")
    _make_event(some_list, title="mine")
    _make_event(other, title="theirs")
    resp = auth_client.get(f"/api/events?list_id={some_list.id}")
    titles = [e["title"] for e in resp.json()]
    assert titles == ["mine"]


def test_filter_events_by_range_uses_overlap(auth_client, some_list):
    _make_event(some_list, title="before", start=_dt(1, 9), end=_dt(1, 10))
    _make_event(some_list, title="spans-edge", start=_dt(9, 23), end=_dt(10, 1))
    _make_event(some_list, title="inside", start=_dt(12, 9), end=_dt(12, 10))
    _make_event(some_list, title="after", start=_dt(20, 9), end=_dt(20, 10))
    resp = auth_client.get(
        "/api/events?start=2026-06-10T00:00:00Z&end=2026-06-14T00:00:00Z"
    )
    titles = [e["title"] for e in resp.json()]
    # The event straddling the window's start edge must be included.
    assert titles == ["spans-edge", "inside"]


def test_patch_event(auth_client, some_list):
    event = _make_event(some_list)
    resp = auth_client.patch(
        f"/api/events/{event.id}",
        data={"title": "Renamed", "end": "2026-06-15T11:30:00Z"},
        content_type="application/json",
    )
    assert resp.status_code == 200
    event.refresh_from_db()
    assert event.title == "Renamed"
    assert event.end == _dt(15, 11, 30)


def test_patch_event_rejects_invalid_range(auth_client, some_list):
    event = _make_event(some_list)
    resp = auth_client.patch(
        f"/api/events/{event.id}",
        data={"end": "2026-06-15T08:00:00Z"},
        content_type="application/json",
    )
    assert resp.status_code == 422
    event.refresh_from_db()
    assert event.end == _dt(15, 10)


def test_delete_event(auth_client, some_list):
    event = _make_event(some_list)
    resp = auth_client.delete(f"/api/events/{event.id}")
    assert resp.status_code == 200
    assert not Event.objects.filter(id=event.id).exists()


def test_events_require_auth(client, some_list):
    assert client.get("/api/events").status_code == 401
    resp = client.post(
        "/api/events",
        data={
            "title": "x",
            "list_id": some_list.id,
            "start": "2026-06-15T09:00:00Z",
            "end": "2026-06-15T10:00:00Z",
        },
        content_type="application/json",
    )
    assert resp.status_code == 401


def test_deleting_list_cascades_events(auth_client, some_list):
    _make_event(some_list)
    resp = auth_client.delete(f"/api/lists/{some_list.id}")
    assert resp.status_code == 200
    assert Event.objects.count() == 0


def _roundtrip(event: Event) -> dict:
    ical = _build_vevent(event, uid="test-uid")
    comp = next(
        c for c in Calendar.from_ical(ical).walk() if c.name == "VEVENT"
    )
    return _parse_vevent(comp)


def test_vevent_roundtrip_timed(some_list):
    event = _make_event(
        some_list,
        title="Standup; daily",
        description="Notes,\nwith newline",
        start=_dt(15, 9, 30),
        end=_dt(15, 10, 15),
    )
    fields = _roundtrip(event)
    assert fields["title"] == event.title
    assert fields["description"] == event.description
    assert fields["start"] == event.start
    assert fields["end"] == event.end
    assert fields["all_day"] is False


def test_vevent_roundtrip_all_day(some_list):
    event = _make_event(
        some_list,
        title="Conference",
        start=_dt(15, 0),
        end=_dt(16, 0),
        all_day=True,
    )
    ical = _build_vevent(event, uid="test-uid")
    # All-day events serialize as date-only with an exclusive DTEND (+1 day).
    assert "DTSTART;VALUE=DATE:20260615" in ical
    assert "DTEND;VALUE=DATE:20260617" in ical

    fields = _roundtrip(event)
    assert fields["all_day"] is True
    assert fields["start"] == event.start
    assert fields["end"] == event.end
