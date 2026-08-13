"""Recurring transaction auto-generation service."""

from datetime import date, datetime, timezone
from sqlalchemy.orm import Session
from database import RecurringTransaction, Transaction, Wallet, generate_uuid, utcnow


def process_recurring_transactions(db: Session) -> int:
    """
    Check all active recurring transactions and generate any that are due.
    Returns the number of transactions generated.
    """
    today = date.today()
    count = 0

    active_recurring = db.query(RecurringTransaction).filter(
        RecurringTransaction.is_active == True,
        RecurringTransaction.start_date <= today,
    ).all()

    for rec in active_recurring:
        # Check if end_date has passed
        if rec.end_date and rec.end_date < today:
            rec.is_active = False
            continue

        # Determine if we need to generate a transaction
        should_generate = False

        if rec.frequency == "monthly":
            if today.day >= rec.day_of_month:
                # Check if already generated this month
                if rec.last_generated is None or (
                    rec.last_generated.year < today.year or
                    (rec.last_generated.year == today.year and rec.last_generated.month < today.month)
                ):
                    should_generate = True

        elif rec.frequency == "daily":
            if rec.last_generated is None or rec.last_generated < today:
                should_generate = True

        elif rec.frequency == "weekly":
            if rec.last_generated is None:
                should_generate = True
            else:
                days_since = (today - rec.last_generated).days
                if days_since >= 7:
                    should_generate = True

        elif rec.frequency == "yearly":
            if rec.last_generated is None or rec.last_generated.year < today.year:
                if today.month >= rec.start_date.month and today.day >= rec.day_of_month:
                    should_generate = True

        if should_generate:
            # Create the transaction
            txn_date = datetime(today.year, today.month, min(rec.day_of_month, 28), tzinfo=timezone.utc)
            txn = Transaction(
                id=generate_uuid(),
                type=rec.type,
                amount=rec.amount,
                category_id=rec.category_id,
                wallet_id=rec.wallet_id,
                description=f"[อัตโนมัติ] {rec.description}",
                transaction_date=txn_date,
            )
            db.add(txn)

            # Update wallet balance
            wallet = db.query(Wallet).filter(Wallet.id == rec.wallet_id).first()
            if wallet:
                if rec.type == "income":
                    wallet.balance += rec.amount
                elif rec.type == "expense":
                    wallet.balance -= rec.amount
                wallet.updated_at = utcnow()

            rec.last_generated = today
            count += 1

    db.commit()
    return count
