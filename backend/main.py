import os
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from dotenv import load_dotenv
import uvicorn

# Import local modules
from database import (
    init_database, run_cleanup,
    get_user_cards, get_card, create_card, update_card, delete_card,
    get_user_card_jobs, get_card_job,
    get_examples, get_example,
    get_admin_stats, get_all_users, get_all_cards, is_user_admin
)
from card_generation import generate_card_variants_stream, generate_card_message
from user_auth import router as user_auth_router
from admin import router as admin_router
from auth_utils import get_current_user_id
from logger_config import app_logger as logger

load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Best Wishes API",
    description="AI-powered greeting card generation service",
    version="1.0.0"
)

# Configure CORS
frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    frontend_url
]
allowed_origins = list(set(allowed_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(user_auth_router)
app.include_router(admin_router)

# Initialize scheduler
scheduler = BackgroundScheduler()


# ===== PYDANTIC MODELS =====

class CardGenerateRequest(BaseModel):
    prompt: str
    occasion: Optional[str] = None
    style: Optional[str] = None


class CardUpdateRequest(BaseModel):
    base_message: Optional[str] = None
    status: Optional[str] = None


class MessageGenerateRequest(BaseModel):
    card_id: int
    tone: Optional[str] = "friendly"


# ===== LIFECYCLE EVENTS =====

def run_cleanup_job():
    """Background job to cleanup old files."""
    try:
        result = run_cleanup(job_hours=24)
        if result["card_jobs_deleted"] > 0:
            logger.info(f"Cleanup completed: {result['card_jobs_deleted']} old jobs deleted")
    except Exception as e:
        logger.error(f"Cleanup job failed: {e}", exc_info=True)


@app.on_event("startup")
async def startup_event():
    """Initialize database and scheduler on startup."""
    logger.info("Starting Best Wishes API...")

    # Initialize database
    init_database()
    logger.info("Database initialized")

    # Start scheduler
    scheduler.start()
    logger.info("Scheduler started")

    # Add cleanup job (runs every hour)
    scheduler.add_job(
        run_cleanup_job,
        IntervalTrigger(hours=1),
        id="cleanup_job",
        name="Cleanup old card jobs",
        replace_existing=True
    )
    logger.info("Cleanup job scheduled")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    logger.info("Shutting down Best Wishes API...")
    scheduler.shutdown()
    logger.info("Scheduler stopped")


# ===== API ENDPOINTS =====

@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "running",
        "service": "Best Wishes API",
        "version": "1.0.0"
    }


# ===== CARD ENDPOINTS =====

@app.get("/api/cards")
async def list_cards(user_id: int = Depends(get_current_user_id)):
    """List all cards for the current user."""
    cards = get_user_cards(user_id)
    return {"cards": cards}


@app.get("/api/cards/{card_id}")
async def get_card_detail(card_id: int, user_id: int = Depends(get_current_user_id)):
    """Get a specific card with full details."""
    card = get_card(card_id, user_id)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


@app.post("/api/cards/generate-stream")
async def generate_card_stream_endpoint(
    prompt: str = Form(...),
    occasion: str = Form(None),
    style: str = Form(None),
    photos: List[UploadFile] = File(default=[]),
    user_id: int = Depends(get_current_user_id)
):
    """
    Generate card designs from prompt and optional photos.
    Returns SSE stream with generation progress.
    """
    # Read photo data
    photo_data = []
    for photo in photos:
        if photo.filename:  # Skip empty uploads
            content = await photo.read()
            if content:
                photo_data.append(content)

    def generate():
        # Use the card generation stream
        for event in generate_card_variants_stream(
            user_id=user_id,
            prompt=prompt,
            occasion=occasion,
            style=style,
            photos=photo_data if photo_data else None,
            num_variants=4
        ):
            yield f"data: {event}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.post("/api/cards/{card_id}/save")
async def save_card(
    card_id: int,
    request: CardUpdateRequest,
    user_id: int = Depends(get_current_user_id)
):
    """Save/update a card."""
    updates = {}
    if request.base_message is not None:
        updates['base_message'] = request.base_message
    if request.status is not None:
        updates['status'] = request.status

    if updates:
        success = update_card(card_id, user_id, **updates)
        if not success:
            raise HTTPException(status_code=404, detail="Card not found")

    return {"success": True}


@app.delete("/api/cards/{card_id}")
async def delete_card_endpoint(card_id: int, user_id: int = Depends(get_current_user_id)):
    """Delete a card."""
    success = delete_card(card_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Card not found")
    return {"success": True}


# ===== MESSAGE GENERATION =====

@app.post("/api/messages/generate")
async def generate_message_endpoint(
    request: MessageGenerateRequest,
    user_id: int = Depends(get_current_user_id)
):
    """Generate a message for a card using AI."""
    card = get_card(request.card_id, user_id)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    # Use the card's prompt and occasion for context
    result = generate_card_message(
        prompt=card.get('prompt', ''),
        occasion=card.get('occasion'),
        tone=request.tone or "warm"
    )

    return result


# ===== EXAMPLES GALLERY =====

@app.get("/api/examples")
async def list_examples(occasion: Optional[str] = None):
    """Get example cards for inspiration gallery."""
    examples = get_examples(occasion=occasion)
    return {"examples": examples}


@app.get("/api/examples/{example_id}")
async def get_example_detail(example_id: int):
    """Get a specific example with full image."""
    example = get_example(example_id)
    if not example:
        raise HTTPException(status_code=404, detail="Example not found")
    return example


@app.post("/api/examples/{example_id}/use")
async def use_example(example_id: int, user_id: int = Depends(get_current_user_id)):
    """Start a new card based on an example."""
    example = get_example(example_id)
    if not example:
        raise HTTPException(status_code=404, detail="Example not found")

    return {
        "prompt": example['prompt'],
        "occasion": example.get('occasion'),
        "style_tags": example.get('style_tags', [])
    }


# ===== CARD JOBS (for async generation tracking) =====

@app.get("/api/jobs")
async def list_jobs(user_id: int = Depends(get_current_user_id)):
    """List recent card generation jobs."""
    jobs = get_user_card_jobs(user_id)
    return {"jobs": jobs}


@app.get("/api/jobs/{job_uuid}")
async def get_job_status(job_uuid: str, user_id: int = Depends(get_current_user_id)):
    """Get status of a card generation job."""
    job = get_card_job(job_uuid=job_uuid, user_id=user_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
