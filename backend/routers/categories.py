"""Category CRUD API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, Category, generate_uuid
from schemas import CategoryCreate, CategoryResponse

router = APIRouter()


@router.get("/", response_model=list[CategoryResponse])
def list_categories(type: str = None, db: Session = Depends(get_db)):
    query = db.query(Category)
    if type:
        query = query.filter(Category.type == type)
    return query.order_by(Category.type, Category.name).all()


@router.post("/", response_model=CategoryResponse)
def create_category(data: CategoryCreate, db: Session = Depends(get_db)):
    cat = Category(id=generate_uuid(), **data.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{category_id}")
def delete_category(category_id: str, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="ไม่พบหมวดหมู่")
    if cat.is_default:
        raise HTTPException(status_code=400, detail="ไม่สามารถลบหมวดหมู่เริ่มต้นได้")
    db.delete(cat)
    db.commit()
    return {"message": "ลบหมวดหมู่สำเร็จ"}
