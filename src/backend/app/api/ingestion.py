from fastapi import APIRouter, UploadFile, File, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.services.ingestion_gateway import gateway_service
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.database.connection import get_db_session
router = APIRouter(prefix="/api/v1/ingestion", tags=["Ingestion"])

@router.post("/resumes", status_code=status.HTTP_202_ACCEPTED)
async def upload_resume(
    background_tasks: BackgroundTasks,
    user_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db_session)
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted!")
    headerBytes = await file.read(4)
    await file.seek(0)
    if headerBytes != b'%PDF': 
        raise HTTPException(status_code=400, detail="Invalid file or PDF file with structural errors!")
    
    job_id = gateway_service.create_job(file, user_id)
    background_tasks.add_task(gateway_service.run_job, job_id, db)
    return {"job_id": job_id, "status": "QUEUED"}

@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    job = gateway_service.jobs.get(job_id)
    if not job: 
        raise HTTPException(status_code=404, detail="Job ID (Job Loading Session ID) not found!")
    return {
        "job_id": job["job_id"],
        "status": job["status"],
        "error": job["error"]
    }