import os, uuid, shutil
from datetime import datetime
from typing import Dict,Any
from fastapi import UploadFile
from sqlalchemy.orm import Session

from backend.app.services.websocket_manager import manager
from backend.app.schemas.ingestion_event import IngestionEvent, IngestionEventType
from backend.app.pipelines.resumeUploading_pipeline import ResumePipeline

class IngestionGateway:
    def __init__(self):
        self.upload_dir = "shared_uploads"
        os.makedirs(self.upload_dir, exist_ok=True)
        self.jobs: Dict[str, Dict[str, Any]] = {}
    
    def create_job(self, file: UploadFile, user_id: int) ->str:
        job_id = str(uuid.uuid4())
        file_ext = os.path.splitext(file.filename)[1]
        saved_filename = f"{job_id}{file_ext}"
        file_path = os.path.join(self.upload_dir, saved_filename)

        with open(file_path, 'wb') as buffer:
            shutil.copyfileobj(file.file, buffer)
        self.jobs[job_id] = {
            "job_id": job_id,
            "user_id": user_id,
            "status": IngestionEventType.INGESTION_QUEUED,
            "file_path": file_path,
            "error": None,
            "created_at": datetime.utcnow()
        }
        return job_id

    async def run_job(self, job_id: str, db_session: Session):
        job = self.jobs.get(job_id)
        if not job:
            return
        try:
            await self._emit_progress(job_id, IngestionEventType.PARSING_STARTED)
            pipeline = ResumePipeline()
            await self._emit_progress(job_id, IngestionEventType.ANALYSIS_STARTED)
            result = await pipeline.process(file_path=job["file_path"], user_id=job["user_id"], session=db_session)
            final_analytics_payload = {
                "personal_info" :{"name":"Candidate Name", "email": "extracted@gmail.com"},
                "skills": ["Python", "FastAPI", "Docker"],
                "experience_timeline": [],
                "strengths": ["Strong system design foundation"],
                "weaknesses": ["Needs more experience with cloud infra"]
            }
            await self._emit_progress(job_id, IngestionEventType.PERSISTENCE_COMPLETE)
            await self._emit_progress(job_id, IngestionEventType.AI_ANALYTICS_COMPLETE, data=final_analytics_payload)
        except Exception as e:
            self.jobs[job_id]["status"] = IngestionEventType.INGESTION_FAILED
            self.jobs[job_id]["error"] = str(e)
            event = IngestionEvent(
                type=IngestionEventType.INGESTION_FAILED,
                job_id = job_id,
                error = str(e)
            )
            await manager.broadcast(job_id, event.model_dump(mode="json"))

    async def _emit_progress(self, job_id: str, event_type: IngestionEventType, data: Any=None):
        self.jobs[job_id]["status"] = event_type
        event = IngestionEvent(type = event_type, job_id=job_id, data=data)
        await manager.broadcast(job_id, event.model_dump(mode="json"))

gateway_service = IngestionGateway()