"""Wallet CRUD API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, Wallet, generate_uuid, utcnow
from schemas import WalletCreate, WalletUpdate, WalletResponse

router = APIRouter()


@router.get("/", response_model=list[WalletResponse])
def list_wallets(db: Session = Depends(get_db)):
    wallets = db.query(Wallet).filter(Wallet.is_active == True).order_by(Wallet.created_at).all()
    return wallets


@router.get("/{wallet_id}", response_model=WalletResponse)
def get_wallet(wallet_id: str, db: Session = Depends(get_db)):
    wallet = db.query(Wallet).filter(Wallet.id == wallet_id).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="ไม่พบกระเป๋าเงิน")
    return wallet


@router.post("/", response_model=WalletResponse)
def create_wallet(data: WalletCreate, db: Session = Depends(get_db)):
    wallet = Wallet(id=generate_uuid(), **data.model_dump())
    db.add(wallet)
    db.commit()
    db.refresh(wallet)
    return wallet


@router.put("/{wallet_id}", response_model=WalletResponse)
def update_wallet(wallet_id: str, data: WalletUpdate, db: Session = Depends(get_db)):
    wallet = db.query(Wallet).filter(Wallet.id == wallet_id).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="ไม่พบกระเป๋าเงิน")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(wallet, key, value)
    wallet.updated_at = utcnow()
    db.commit()
    db.refresh(wallet)
    return wallet


@router.delete("/{wallet_id}")
def delete_wallet(wallet_id: str, db: Session = Depends(get_db)):
    wallet = db.query(Wallet).filter(Wallet.id == wallet_id).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="ไม่พบกระเป๋าเงิน")
    wallet.is_active = False
    db.commit()
    return {"message": "ลบกระเป๋าเงินสำเร็จ"}
