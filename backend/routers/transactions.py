"""Transaction CRUD API routes with wallet balance updates."""

import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from database import get_db, Transaction, Wallet, Category, generate_uuid, utcnow
from schemas import TransactionCreate, TransactionUpdate, TransactionResponse
from config import settings

router = APIRouter()


def _apply_wallet_change(db: Session, wallet_id: str, amount: float, txn_type: str, reverse: bool = False):
    """Update wallet balance based on transaction type."""
    wallet = db.query(Wallet).filter(Wallet.id == wallet_id).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="ไม่พบกระเป๋าเงิน")
    multiplier = -1 if reverse else 1
    if txn_type == "income":
        wallet.balance += amount * multiplier
    elif txn_type == "expense":
        wallet.balance -= amount * multiplier
    elif txn_type == "transfer":
        wallet.balance -= amount * multiplier  # source wallet
    wallet.updated_at = utcnow()


def _enrich_transaction(txn: Transaction, db: Session) -> dict:
    """Add category and wallet names to transaction response."""
    data = {
        "id": txn.id,
        "type": txn.type,
        "amount": txn.amount,
        "category_id": txn.category_id,
        "wallet_id": txn.wallet_id,
        "to_wallet_id": txn.to_wallet_id,
        "description": txn.description,
        "receipt_url": txn.receipt_url,
        "transaction_date": txn.transaction_date,
        "created_at": txn.created_at,
        "updated_at": txn.updated_at,
    }
    if txn.category:
        data["category_name"] = txn.category.name
        data["category_icon"] = txn.category.icon
        data["category_color"] = txn.category.color
    if txn.wallet:
        data["wallet_name"] = txn.wallet.name
    if txn.to_wallet:
        data["to_wallet_name"] = txn.to_wallet.name
    return data


@router.get("/", response_model=list[TransactionResponse])
def list_transactions(
    month: int = None,
    year: int = None,
    wallet_id: str = None,
    category_id: str = None,
    type: str = None,
    limit: int = Query(default=100, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
):
    query = db.query(Transaction)
    if month and year:
        start = datetime(year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end = datetime(year, month + 1, 1, tzinfo=timezone.utc)
        query = query.filter(Transaction.transaction_date >= start, Transaction.transaction_date < end)
    if wallet_id:
        query = query.filter(
            (Transaction.wallet_id == wallet_id) | (Transaction.to_wallet_id == wallet_id)
        )
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if type:
        query = query.filter(Transaction.type == type)

    txns = query.order_by(Transaction.transaction_date.desc()).offset(offset).limit(limit).all()
    return [_enrich_transaction(t, db) for t in txns]


@router.post("/", response_model=TransactionResponse)
def create_transaction(data: TransactionCreate, db: Session = Depends(get_db)):
    # Validate transfer
    if data.type == "transfer" and not data.to_wallet_id:
        raise HTTPException(status_code=400, detail="การโอนเงินต้องระบุกระเป๋าปลายทาง")
    if data.type == "transfer" and data.wallet_id == data.to_wallet_id:
        raise HTTPException(status_code=400, detail="ไม่สามารถโอนเงินไปยังกระเป๋าเดียวกัน")

    txn_date = data.transaction_date or utcnow()
    txn = Transaction(
        id=generate_uuid(),
        type=data.type,
        amount=data.amount,
        category_id=data.category_id,
        wallet_id=data.wallet_id,
        to_wallet_id=data.to_wallet_id,
        description=data.description,
        transaction_date=txn_date,
    )
    db.add(txn)

    # Update wallet balances
    _apply_wallet_change(db, data.wallet_id, data.amount, data.type)
    if data.type == "transfer" and data.to_wallet_id:
        to_wallet = db.query(Wallet).filter(Wallet.id == data.to_wallet_id).first()
        if not to_wallet:
            raise HTTPException(status_code=404, detail="ไม่พบกระเป๋าปลายทาง")
        to_wallet.balance += data.amount
        to_wallet.updated_at = utcnow()

    db.commit()
    db.refresh(txn)
    return _enrich_transaction(txn, db)


@router.put("/{txn_id}", response_model=TransactionResponse)
def update_transaction(txn_id: str, data: TransactionUpdate, db: Session = Depends(get_db)):
    txn = db.query(Transaction).filter(Transaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="ไม่พบรายการ")

    # Reverse old wallet change
    _apply_wallet_change(db, txn.wallet_id, txn.amount, txn.type, reverse=True)
    if txn.type == "transfer" and txn.to_wallet_id:
        to_wallet = db.query(Wallet).filter(Wallet.id == txn.to_wallet_id).first()
        if to_wallet:
            to_wallet.balance -= txn.amount

    # Apply updates
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(txn, key, value)
    txn.updated_at = utcnow()

    # Apply new wallet change
    _apply_wallet_change(db, txn.wallet_id, txn.amount, txn.type)
    if txn.type == "transfer" and txn.to_wallet_id:
        to_wallet = db.query(Wallet).filter(Wallet.id == txn.to_wallet_id).first()
        if to_wallet:
            to_wallet.balance += txn.amount

    db.commit()
    db.refresh(txn)
    return _enrich_transaction(txn, db)


@router.delete("/{txn_id}")
def delete_transaction(txn_id: str, db: Session = Depends(get_db)):
    txn = db.query(Transaction).filter(Transaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="ไม่พบรายการ")

    # Reverse wallet balance
    _apply_wallet_change(db, txn.wallet_id, txn.amount, txn.type, reverse=True)
    if txn.type == "transfer" and txn.to_wallet_id:
        to_wallet = db.query(Wallet).filter(Wallet.id == txn.to_wallet_id).first()
        if to_wallet:
            to_wallet.balance -= txn.amount

    db.delete(txn)
    db.commit()
    return {"message": "ลบรายการสำเร็จ"}


@router.post("/{txn_id}/receipt")
async def upload_receipt(txn_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    txn = db.query(Transaction).filter(Transaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="ไม่พบรายการ")

    # Save file
    ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    txn.receipt_url = f"/uploads/{filename}"
    txn.updated_at = utcnow()
    db.commit()
    return {"receipt_url": txn.receipt_url}
