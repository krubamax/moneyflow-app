"""Database setup using SQLAlchemy with SQLite."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    create_engine, Column, String, Float, Boolean, Integer,
    Text, DateTime, Date, ForeignKey, Enum as SAEnum
)
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
import re
from config import settings

def sanitize_db_url(url: str) -> str:
    if not url:
        return url
    # SQLAlchemy requires postgresql:// instead of postgres://
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
        
    # Strip accidental brackets around domain host or password
    if "[" in url:
        bracket_contents = re.findall(r'\[([^\]]+)\]', url)
        has_domain_in_brackets = any(re.search(r'[g-zG-Z]', content) for content in bracket_contents)
        if has_domain_in_brackets or url.count("[") != url.count("]"):
            url = url.replace("[", "").replace("]", "")
            
    try:
        parsed = urlparse(url)
        q = parse_qsl(parsed.query)
        # Remove pgbouncer option which psycopg2 doesn't support
        filtered_q = [(k, v) for k, v in q if k.lower() != 'pgbouncer']
        parsed = parsed._replace(query=urlencode(filtered_q))
        return urlunparse(parsed)
    except Exception:
        return url

db_url = sanitize_db_url(settings.DATABASE_URL)
connect_args = {"check_same_thread": False} if "sqlite" in db_url else {}

engine = create_engine(
    db_url,
    connect_args=connect_args
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency: yield a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def generate_uuid():
    return str(uuid.uuid4())


def utcnow():
    return datetime.now(timezone.utc)


# ──────────────────────────────────────────────
# Models
# ──────────────────────────────────────────────

class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    type = Column(String(20), nullable=False, default="cash")  # cash, bank, investment, e_wallet
    balance = Column(Float, nullable=False, default=0.0)
    icon = Column(String(50), default="💰")
    color = Column(String(7), default="#4ECDC4")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    transactions = relationship("Transaction", back_populates="wallet", foreign_keys="Transaction.wallet_id")


class Category(Base):
    __tablename__ = "categories"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    type = Column(String(10), nullable=False)  # income, expense
    icon = Column(String(50), default="📂")
    color = Column(String(7), default="#AEB6BF")
    parent_id = Column(String, ForeignKey("categories.id"), nullable=True)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)

    transactions = relationship("Transaction", back_populates="category")
    budgets = relationship("Budget", back_populates="category")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, default=generate_uuid)
    type = Column(String(10), nullable=False)  # income, expense, transfer
    amount = Column(Float, nullable=False)
    category_id = Column(String, ForeignKey("categories.id"), nullable=True)
    wallet_id = Column(String, ForeignKey("wallets.id"), nullable=False)
    to_wallet_id = Column(String, ForeignKey("wallets.id"), nullable=True)
    description = Column(Text, default="")
    receipt_url = Column(String(500), nullable=True)
    transaction_date = Column(DateTime, nullable=False, default=utcnow)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    wallet = relationship("Wallet", back_populates="transactions", foreign_keys=[wallet_id])
    to_wallet = relationship("Wallet", foreign_keys=[to_wallet_id])
    category = relationship("Category", back_populates="transactions")


class Budget(Base):
    __tablename__ = "budgets"

    id = Column(String, primary_key=True, default=generate_uuid)
    category_id = Column(String, ForeignKey("categories.id"), nullable=False)
    amount = Column(Float, nullable=False)
    period = Column(String(10), default="monthly")  # monthly, weekly, yearly
    alert_threshold = Column(Float, default=80.0)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=utcnow)

    category = relationship("Category", back_populates="budgets")


class RecurringTransaction(Base):
    __tablename__ = "recurring_transactions"

    id = Column(String, primary_key=True, default=generate_uuid)
    type = Column(String(10), nullable=False)  # income, expense
    amount = Column(Float, nullable=False)
    category_id = Column(String, ForeignKey("categories.id"), nullable=False)
    wallet_id = Column(String, ForeignKey("wallets.id"), nullable=False)
    description = Column(Text, default="")
    frequency = Column(String(10), default="monthly")  # daily, weekly, monthly, yearly
    day_of_month = Column(Integer, default=1)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)
    last_generated = Column(Date, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    category = relationship("Category")
    wallet = relationship("Wallet")


# ──────────────────────────────────────────────
# Seed default categories
# ──────────────────────────────────────────────

DEFAULT_CATEGORIES = [
    # Expense categories
    {"name": "อาหารและเครื่องดื่ม", "type": "expense", "icon": "🍜", "color": "#FF6B6B"},
    {"name": "เดินทาง/ค่าเดินทาง", "type": "expense", "icon": "🚗", "color": "#4ECDC4"},
    {"name": "ที่พัก/ค่าเช่า", "type": "expense", "icon": "🏠", "color": "#45B7D1"},
    {"name": "ช้อปปิ้ง", "type": "expense", "icon": "🛒", "color": "#F7DC6F"},
    {"name": "ค่าบริการรายเดือน", "type": "expense", "icon": "📱", "color": "#BB8FCE"},
    {"name": "ค่าอินเทอร์เน็ต/โทรศัพท์", "type": "expense", "icon": "🌐", "color": "#82E0AA"},
    {"name": "สุขภาพ/ยา", "type": "expense", "icon": "🏥", "color": "#F1948A"},
    {"name": "การศึกษา", "type": "expense", "icon": "📚", "color": "#85C1E9"},
    {"name": "บันเทิง/ท่องเที่ยว", "type": "expense", "icon": "🎮", "color": "#F0B27A"},
    {"name": "ค่าใช้จ่ายทั่วไป", "type": "expense", "icon": "💼", "color": "#AEB6BF"},
    # Income categories
    {"name": "เงินเดือน", "type": "income", "icon": "💰", "color": "#2ECC71"},
    {"name": "รายได้เสริม/Freelance", "type": "income", "icon": "💵", "color": "#27AE60"},
    {"name": "กำไรจากการลงทุน", "type": "income", "icon": "📈", "color": "#1ABC9C"},
    {"name": "เงินที่ได้รับ/ของขวัญ", "type": "income", "icon": "🎁", "color": "#3498DB"},
    {"name": "รายรับอื่นๆ", "type": "income", "icon": "💸", "color": "#16A085"},
]


def seed_categories(db):
    """Insert default categories if none exist."""
    existing = db.query(Category).count()
    if existing == 0:
        for cat_data in DEFAULT_CATEGORIES:
            cat = Category(
                id=generate_uuid(),
                is_default=True,
                **cat_data
            )
            db.add(cat)
        db.commit()


def init_db():
    """Create all tables and seed data."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_categories(db)
    finally:
        db.close()
