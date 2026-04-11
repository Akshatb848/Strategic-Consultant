from __future__ import annotations

import json
import queue
import threading
from collections import defaultdict


class EventBus:
    def __init__(self) -> None:
        self._subscribers: dict[str, list[queue.Queue]] = defaultdict(list)
        self._lock = threading.Lock()

    def subscribe(self, analysis_id: str) -> queue.Queue:
        q: queue.Queue = queue.Queue()
        with self._lock:
            self._subscribers[analysis_id].append(q)
        return q

    def unsubscribe(self, analysis_id: str, q: queue.Queue) -> None:
        with self._lock:
            subscribers = self._subscribers.get(analysis_id, [])
            if q in subscribers:
                subscribers.remove(q)
            if not subscribers and analysis_id in self._subscribers:
                del self._subscribers[analysis_id]

    def publish(self, analysis_id: str, event: str, data: dict) -> None:
        payload = {"event": event, "data": data}
        with self._lock:
            subscribers = list(self._subscribers.get(analysis_id, []))
        for subscriber in subscribers:
            subscriber.put(payload)

    @staticmethod
    def format_message(event: str, data: dict) -> str:
        return f"event: {event}\\ndata: {json.dumps(data, default=str)}\\n\\n"


event_bus = EventBus()
