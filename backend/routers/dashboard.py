"""Dashboard summary API routes."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db, Transaction, Wallet, Category
from schemas import DashboardSummary, CategoryBreakdown, MonthlyComparison, WalletResponse

router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
def get_summary(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020),
    db: Session = Depends(get_db),
):
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    end = datetime(year + 1, 1, 1, tzinfo=timezone.utc) if month == 12 else datetime(year, month + 1, 1, tzinfo=timezone.utc)

    income = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.type == "income",
        Transaction.transaction_date >= start,
        Transaction.transaction_date < end,
    ).scalar()

    expense = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.type == "expense",
        Transaction.transaction_date >= start,
        Transaction.transaction_date < end,
    ).scalar()

    count = db.query(func.count(Transaction.id)).filter(
        Transaction.transaction_date >= start,
        Transaction.transaction_date < end,
    ).scalar()

    return DashboardSummary(
        total_income=float(income),
        total_expense=float(expense),
        net_balance=float(income) - float(expense),
        transaction_count=count,
        month=month,
        year=year,
    )


@router.get("/category-breakdown", response_model=list[CategoryBreakdown])
def get_category_breakdown(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020),
    type: str = Query(default="expense"),
    db: Session = Depends(get_db),
):
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    end = datetime(year + 1, 1, 1, tzinfo=timezone.utc) if month == 12 else datetime(year, month + 1, 1, tzinfo=timezone.utc)

    results = db.query(
        Transaction.category_id,
        func.sum(Transaction.amount).label("total"),
        func.count(Transaction.id).label("count"),
    ).filter(
        Transaction.type == type,
        Transaction.transaction_date >= start,
        Transaction.transaction_date < end,
        Transaction.category_id.isnot(None),
    ).group_by(Transaction.category_id).all()

    grand_total = sum(r.total for r in results) if results else 1

    breakdowns = []
    for r in results:
        cat = db.query(Category).filter(Category.id == r.category_id).first()
        if cat:
            breakdowns.append(CategoryBreakdown(
                category_id=r.category_id,
                category_name=cat.name,
                category_icon=cat.icon,
                category_color=cat.color,
                total=float(r.total),
                percentage=round(float(r.total) / grand_total * 100, 1),
                count=r.count,
            ))

    return sorted(breakdowns, key=lambda x: x.total, reverse=True)


@router.get("/monthly-comparison", response_model=list[MonthlyComparison])
def get_monthly_comparison(
    year: int = Query(..., ge=2020),
    db: Session = Depends(get_db),
):
    comparisons = []
    for month in range(1, 13):
        start = datetime(year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end = datetime(year, month + 1, 1, tzinfo=timezone.utc)

        income = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
            Transaction.type == "income",
            Transaction.transaction_date >= start,
            Transaction.transaction_date < end,
        ).scalar()

        expense = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
            Transaction.type == "expense",
            Transaction.transaction_date >= start,
            Transaction.transaction_date < end,
        ).scalar()

        comparisons.append(MonthlyComparison(
            month=month,
            year=year,
            income=float(income),
            expense=float(expense),
            net=float(income) - float(expense),
        ))

    return comparisons


@router.get("/wallet-balances", response_model=list[WalletResponse])
def get_wallet_balances(db: Session = Depends(get_db)):
    wallets = db.query(Wallet).filter(Wallet.is_active == True).order_by(Wallet.name).all()
    return wallets
