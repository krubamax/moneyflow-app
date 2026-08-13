"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from config import settings
from database import init_db

# Import routers
from routers import wallets, categories, transactions, budgets, recurring, dashboard, export

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="ระบบจัดการรายรับ-รายจ่ายส่วนบุคคล"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads directory for receipt images
uploads_path = Path(settings.UPLOAD_DIR)
uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")

# Mount frontend
frontend_path = Path(__file__).parent.parent / "frontend"
if frontend_path.exists():
    app.mount("/app", StaticFiles(directory=str(frontend_path), html=True), name="frontend")

# Include routers
app.include_router(wallets.router, prefix="/api/wallets", tags=["Wallets"])
app.include_router(categories.router, prefix="/api/categories", tags=["Categories"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["Transactions"])
app.include_router(budgets.router, prefix="/api/budgets", tags=["Budgets"])
app.include_router(recurring.router, prefix="/api/recurring", tags=["Recurring"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(export.router, prefix="/api/export", tags=["Export"])


@app.on_event("startup")
def startup():
    """Initialize database and process recurring transactions."""
    init_db()
    # Process any pending recurring transactions
    from services.recurring_service import process_recurring_transactions
    from database import SessionLocal
    db = SessionLocal()
    try:
        process_recurring_transactions(db)
    finally:
        db.close()


@app.api_route("/", methods=["GET", "HEAD"])
def root():
    """Redirect to frontend."""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/app/index.html")


@app.api_route("/api/health", methods=["GET", "HEAD"])
def health():
    return {"status": "ok", "app": settings.APP_NAME}
