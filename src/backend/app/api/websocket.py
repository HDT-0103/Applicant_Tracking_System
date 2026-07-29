from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.app.services.websocket_manager import manager

router = APIRouter(tags=["WebSocket"])

@router.websocket("/ws/v1/ingestion/{job_id}")
async def websocket_ingestion_endpoint(websocket: WebSocket, job_id: str):
    await manager.connect(job_id, websocket)
    try: 
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(job_id, websocket)