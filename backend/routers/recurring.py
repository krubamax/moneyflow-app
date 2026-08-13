"""Recurring transaction CRUD and auto-generation."""

from datetime import datetime, date, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, RecurringTransaction, Transaction, Wallet, Category, generate_uuid, utcnow
from schemas import RecurringCreate, RecurringUpdate, RecurringResponse

router = APIRouter()


def _enrich_recurring(rec: RecurringTransaction, db: Session) -> dict:
    cat = db.query(Category).filter(Category.id == rec.category_id).first()
    wallet = db.query(Wallet).filter(Wallet.id == rec.wallet_id).first()
    return {
        "id": rec.id,
        "type": rec.type,
        "amount": rec.amount,
        "category_id": rec.category_id,
        "wallet_id": rec.wallet_id,
        "description": rec.description,
        "frequency": rec.frequency,
        "day_of_month": rec.day_of_month,
        "start_date": rec.start_date,
        "end_date": rec.end_date,
        "is_active": rec.is_active,
        "last_generated": rec.last_generated,
        "created_at": rec.created_at,
        "category_name": cat.name if cat else None,
        "category_icon": cat.icon if cat else None,
        "wallet_name": wallet.name if wallet else None,
    }


@router.get("/", response_model=list[RecurringResponse])
def list_recurring(db: Session = Depends(get_db)):
    recs = db.query(RecurringTransaction).order_by(RecurringTransaction.created_at.desc()).all()
    return [_enrich_recurring(r, db) for r in recs]


@router.post("/", response_model=RecurringResponse)
def create_recurring(data: RecurringCreate, db: Session = Depends(get_db)):
    rec = RecurringTransaction(id=generate_uuid(), **data.model_dump())
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return _enrich_recurring(rec, db)


@router.put("/{rec_id}", response_model=RecurringResponse)
def update_recurring(rec_id: str, data: RecurringUpdate, db: Session = Depends(get_db)):
    rec = db.query(RecurringTransaction).filter(RecurringTransaction.id == rec_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="ไม่พบรายการประจำ")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(rec, key, value)
    db.commit()
    db.refresh(rec)
    return _enrich_recurring(rec, db)


@router.delete("/{rec_id}")
def delete_recurring(rec_id: str, db: Session = Depends(get_db)):
    rec = db.query(RecurringTransaction).filter(RecurringTransaction.id == rec_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="ไม่พบรายการประจำ")
    db.delete(rec)
    db.commit()
    return {"message": "ลบรายการประจำสำเร็จ"}


@router.post("/process")
def trigger_process(db: Session = Depends(get_db)):
    """Manually trigger recurring transaction processing."""
    from services.recurring_service import process_recurring_transactions
    count = process_recurring_transactions(db)
    return {"message": f"สร้างรายการอัตโนมัติ {count} รายการ"}
