from fastapi import WebSocket
from typing import Dict,List
import json

class WebSocketConnectionManager:
    def __init__(self):
        # Thiết kế Map: job_id -> List các kết nối socket đang subscribe job đó
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, job_id: str, websocket: WebSocket):
        await websocket.accept()
        if job_id not in self.active_connections:
            self.active_connections[job_id] =[]
        self.active_connections[job_id].append(websocket)

    async def disconnect(self, job_id: str, websocket: WebSocket):
        if job_id in self.active_connections:
            self.active_connections[job_id].remove(websocket)
            if not self.active_connections[job_id]:
                del self.active_connections[job_id]

    async def broadcast(self, job_id: str, message: dict):
        if job_id in self.active_connections:
            for connection in self.active_connections[job_id]:
                try:
                    await connection.send_text(json.dumps(message))
                except Exception:
                    await self.disconnect(job_id, connection)

manager = WebSocketConnectionManager()