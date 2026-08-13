"""Pydantic schemas for API request/response validation."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date


# ──────────────────────────────────────────────
# Wallet Schemas
# ──────────────────────────────────────────────

class WalletCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: str = Field(default="cash", pattern="^(cash|bank|investment|e_wallet)$")
    balance: float = Field(default=0.0, ge=0)
    icon: str = Field(default="💰")
    color: str = Field(default="#4ECDC4")


class WalletUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    balance: Optional[float] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None


class WalletResponse(BaseModel):
    id: str
    name: str
    type: str
    balance: float
    icon: str
    color: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────
# Category Schemas
# ──────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: str = Field(..., pattern="^(income|expense)$")
    icon: str = Field(default="📂")
    color: str = Field(default="#AEB6BF")
    parent_id: Optional[str] = None


class CategoryResponse(BaseModel):
    id: str
    name: str
    type: str
    icon: str
    color: str
    parent_id: Optional[str]
    is_default: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────
# Transaction Schemas
# ──────────────────────────────────────────────

class TransactionCreate(BaseModel):
    type: str = Field(..., pattern="^(income|expense|transfer)$")
    amount: float = Field(..., gt=0)
    category_id: Optional[str] = None
    wallet_id: str
    to_wallet_id: Optional[str] = None
    description: str = ""
    transaction_date: Optional[datetime] = None


class TransactionUpdate(BaseModel):
    type: Optional[str] = None
    amount: Optional[float] = None
    category_id: Optional[str] = None
    wallet_id: Optional[str] = None
    to_wallet_id: Optional[str] = None
    description: Optional[str] = None
    transaction_date: Optional[datetime] = None


class TransactionResponse(BaseModel):
    id: str
    type: str
    amount: float
    category_id: Optional[str]
    wallet_id: str
    to_wallet_id: Optional[str]
    description: str
    receipt_url: Optional[str]
    transaction_date: datetime
    created_at: datetime
    updated_at: datetime
    # Joined fields
    category_name: Optional[str] = None
    category_icon: Optional[str] = None
    category_color: Optional[str] = None
    wallet_name: Optional[str] = None
    to_wallet_name: Optional[str] = None

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────
# Budget Schemas
# ──────────────────────────────────────────────

class BudgetCreate(BaseModel):
    category_id: str
    amount: float = Field(..., gt=0)
    period: str = Field(default="monthly", pattern="^(monthly|weekly|yearly)$")
    alert_threshold: float = Field(default=80.0, ge=0, le=100)
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2020)


class BudgetResponse(BaseModel):
    id: str
    category_id: str
    amount: float
    period: str
    alert_threshold: float
    month: int
    year: int
    created_at: datetime
    # Calculated fields
    spent: float = 0.0
    remaining: float = 0.0
    percentage: float = 0.0
    is_over_threshold: bool = False
    is_over_budget: bool = False
    category_name: Optional[str] = None
    category_icon: Optional[str] = None
    category_color: Optional[str] = None

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────
# Recurring Transaction Schemas
# ──────────────────────────────────────────────

class RecurringCreate(BaseModel):
    type: str = Field(..., pattern="^(income|expense)$")
    amount: float = Field(..., gt=0)
    category_id: str
    wallet_id: str
    description: str = ""
    frequency: str = Field(default="monthly", pattern="^(daily|weekly|monthly|yearly)$")
    day_of_month: int = Field(default=1, ge=1, le=31)
    start_date: date
    end_date: Optional[date] = None


class RecurringUpdate(BaseModel):
    amount: Optional[float] = None
    category_id: Optional[str] = None
    wallet_id: Optional[str] = None
    description: Optional[str] = None
    frequency: Optional[str] = None
    day_of_month: Optional[int] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None


class RecurringResponse(BaseModel):
    id: str
    type: str
    amount: float
    category_id: str
    wallet_id: str
    description: str
    frequency: str
    day_of_month: int
    start_date: date
    end_date: Optional[date]
    is_active: bool
    last_generated: Optional[date]
    created_at: datetime
    category_name: Optional[str] = None
    category_icon: Optional[str] = None
    wallet_name: Optional[str] = None

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────
# Dashboard Schemas
# ──────────────────────────────────────────────

class DashboardSummary(BaseModel):
    total_income: float = 0.0
    total_expense: float = 0.0
    net_balance: float = 0.0
    transaction_count: int = 0
    month: int
    year: int


class CategoryBreakdown(BaseModel):
    category_id: str
    category_name: str
    category_icon: str
    category_color: str
    total: float
    percentage: float
    count: int


class MonthlyComparison(BaseModel):
    month: int
    year: int
    income: float
    expense: float
    net: float
