"""Budget CRUD API routes with spending calculations and alerts."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db, Budget, Transaction, Category, generate_uuid
from schemas import BudgetCreate, BudgetResponse

router = APIRouter()


def _calculate_budget_status(budget: Budget, db: Session) -> dict:
    """Calculate spent amount and alert status for a budget."""
    start = datetime(budget.year, budget.month, 1, tzinfo=timezone.utc)
    if budget.month == 12:
        end = datetime(budget.year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(budget.year, budget.month + 1, 1, tzinfo=timezone.utc)

    spent = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.category_id == budget.category_id,
        Transaction.type == "expense",
        Transaction.transaction_date >= start,
        Transaction.transaction_date < end,
    ).scalar()

    spent = float(spent)
    remaining = budget.amount - spent
    percentage = (spent / budget.amount * 100) if budget.amount > 0 else 0

    cat = db.query(Category).filter(Category.id == budget.category_id).first()

    return {
        "id": budget.id,
        "category_id": budget.category_id,
        "amount": budget.amount,
        "period": budget.period,
        "alert_threshold": budget.alert_threshold,
        "month": budget.month,
        "year": budget.year,
        "created_at": budget.created_at,
        "spent": spent,
        "remaining": remaining,
        "percentage": round(percentage, 1),
        "is_over_threshold": percentage >= budget.alert_threshold,
        "is_over_budget": percentage >= 100,
        "category_name": cat.name if cat else None,
        "category_icon": cat.icon if cat else None,
        "category_color": cat.color if cat else None,
    }


@router.get("/", response_model=list[BudgetResponse])
def list_budgets(month: int = None, year: int = None, db: Session = Depends(get_db)):
    query = db.query(Budget)
    if month:
        query = query.filter(Budget.month == month)
    if year:
        query = query.filter(Budget.year == year)
    budgets = query.all()
    return [_calculate_budget_status(b, db) for b in budgets]


@router.post("/", response_model=BudgetResponse)
def create_budget(data: BudgetCreate, db: Session = Depends(get_db)):
    # Check if budget already exists for this category/month/year
    existing = db.query(Budget).filter(
        Budget.category_id == data.category_id,
        Budget.month == data.month,
        Budget.year == data.year,
    ).first()
    if existing:
        # Update existing budget
        existing.amount = data.amount
        existing.alert_threshold = data.alert_threshold
        db.commit()
        db.refresh(existing)
        return _calculate_budget_status(existing, db)

    budget = Budget(id=generate_uuid(), **data.model_dump())
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return _calculate_budget_status(budget, db)


@router.delete("/{budget_id}")
def delete_budget(budget_id: str, db: Session = Depends(get_db)):
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="ไม่พบงบประมาณ")
    db.delete(budget)
    db.commit()
    return {"message": "ลบงบประมาณสำเร็จ"}


@router.get("/alerts", response_model=list[BudgetResponse])
def get_budget_alerts(month: int = None, year: int = None, db: Session = Depends(get_db)):
    """Get budgets that are over their alert threshold."""
    now = datetime.now(timezone.utc)
    m = month or now.month
    y = year or now.year
    budgets = db.query(Budget).filter(Budget.month == m, Budget.year == y).all()
    results = [_calculate_budget_status(b, db) for b in budgets]
    return [r for r in results if r["is_over_threshold"]]
