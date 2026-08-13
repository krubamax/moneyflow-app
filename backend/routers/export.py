"""Export endpoints: PDF and Google Sheets."""

import os
import io
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from jinja2 import Environment, FileSystemLoader
from database import get_db, Transaction, Category, Wallet
from config import settings

router = APIRouter()

# Jinja2 template environment
TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")
jinja_env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))


def _get_monthly_data(db: Session, month: int, year: int):
    """Fetch and calculate all data for a given month."""
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    end = datetime(year + 1, 1, 1, tzinfo=timezone.utc) if month == 12 else datetime(year, month + 1, 1, tzinfo=timezone.utc)

    # All transactions for the month
    txns = db.query(Transaction).filter(
        Transaction.transaction_date >= start,
        Transaction.transaction_date < end,
    ).order_by(Transaction.transaction_date.asc()).all()

    # Totals
    total_income = sum(t.amount for t in txns if t.type == "income")
    total_expense = sum(t.amount for t in txns if t.type == "expense")

    # Category breakdown
    expense_by_cat = {}
    income_by_cat = {}
    for t in txns:
        cat = db.query(Category).filter(Category.id == t.category_id).first() if t.category_id else None
        cat_name = cat.name if cat else "ไม่ระบุหมวดหมู่"
        cat_icon = cat.icon if cat else "📂"
        cat_color = cat.color if cat else "#AEB6BF"

        target = expense_by_cat if t.type == "expense" else income_by_cat if t.type == "income" else None
        if target is not None:
            if cat_name not in target:
                target[cat_name] = {"total": 0, "count": 0, "icon": cat_icon, "color": cat_color}
            target[cat_name]["total"] += t.amount
            target[cat_name]["count"] += 1

    # Enrich transactions with names
    enriched_txns = []
    for t in txns:
        cat = db.query(Category).filter(Category.id == t.category_id).first() if t.category_id else None
        wallet = db.query(Wallet).filter(Wallet.id == t.wallet_id).first()
        to_wallet = db.query(Wallet).filter(Wallet.id == t.to_wallet_id).first() if t.to_wallet_id else None
        enriched_txns.append({
            "date": t.transaction_date.strftime("%d/%m/%Y"),
            "time": t.transaction_date.strftime("%H:%M"),
            "type": t.type,
            "type_label": {"income": "รายรับ", "expense": "รายจ่าย", "transfer": "โอน"}.get(t.type, t.type),
            "amount": t.amount,
            "category": cat.name if cat else "ไม่ระบุ",
            "category_icon": cat.icon if cat else "📂",
            "wallet": wallet.name if wallet else "ไม่ระบุ",
            "to_wallet": to_wallet.name if to_wallet else "",
            "description": t.description or "",
        })

    # Sort category breakdown by total
    expense_sorted = sorted(expense_by_cat.items(), key=lambda x: x[1]["total"], reverse=True)
    income_sorted = sorted(income_by_cat.items(), key=lambda x: x[1]["total"], reverse=True)

    # Calculate percentages
    for name, data in expense_sorted:
        data["percentage"] = round(data["total"] / total_expense * 100, 1) if total_expense > 0 else 0
    for name, data in income_sorted:
        data["percentage"] = round(data["total"] / total_income * 100, 1) if total_income > 0 else 0

    THAI_MONTHS = [
        "", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
        "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ]

    return {
        "month": month,
        "year": year,
        "month_name": THAI_MONTHS[month],
        "total_income": total_income,
        "total_expense": total_expense,
        "net_balance": total_income - total_expense,
        "expense_by_category": expense_sorted,
        "income_by_category": income_sorted,
        "transactions": enriched_txns,
        "transaction_count": len(enriched_txns),
    }


@router.get("/pdf")
def export_pdf(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020),
    db: Session = Depends(get_db),
):
    """Generate and return a PDF report for the given month."""
    data = _get_monthly_data(db, month, year)

    try:
        template = jinja_env.get_template("pdf_report.html")
        html_content = template.render(**data)

        from weasyprint import HTML
        pdf_bytes = HTML(string=html_content).write_pdf()

        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="report_{year}_{month:02d}.pdf"'
            },
        )
    except ImportError:
        # Fallback: return HTML if WeasyPrint is not installed
        return StreamingResponse(
            io.BytesIO(html_content.encode("utf-8")),
            media_type="text/html",
            headers={
                "Content-Disposition": f'attachment; filename="report_{year}_{month:02d}.html"'
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาดในการสร้าง PDF: {str(e)}")


@router.get("/sheets")
def export_sheets(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020),
    db: Session = Depends(get_db),
):
    """Export data to Google Sheets. Returns the spreadsheet URL."""
    if not settings.GOOGLE_CREDENTIALS_PATH or not os.path.exists(settings.GOOGLE_CREDENTIALS_PATH):
        raise HTTPException(
            status_code=400,
            detail="กรุณาตั้งค่า GOOGLE_CREDENTIALS_PATH ใน .env ก่อนใช้งาน Google Sheets export"
        )

    data = _get_monthly_data(db, month, year)

    try:
        import gspread
        from oauth2client.service_account import ServiceAccountCredentials

        scope = [
            "https://spreadsheets.google.com/feeds",
            "https://www.googleapis.com/auth/drive",
        ]
        creds = ServiceAccountCredentials.from_json_keyfile_name(settings.GOOGLE_CREDENTIALS_PATH, scope)
        gc = gspread.authorize(creds)

        # Create new spreadsheet
        title = f"รายงานรายรับ-รายจ่าย {data['month_name']} {data['year']}"
        sh = gc.create(title)

        # Tab 1: Summary
        summary_ws = sh.sheet1
        summary_ws.update_title("สรุป (Summary)")
        summary_data = [
            ["รายงานรายรับ-รายจ่าย", f"{data['month_name']} {data['year']}"],
            [],
            ["รายได้รวม", f"{data['total_income']:,.2f}"],
            ["รายจ่ายรวม", f"{data['total_expense']:,.2f}"],
            ["ยอดสุทธิ", f"{data['net_balance']:,.2f}"],
            ["จำนวนรายการ", str(data['transaction_count'])],
            [],
            ["── สรุปรายจ่ายตามหมวดหมู่ ──"],
            ["หมวดหมู่", "ยอดรวม", "จำนวน", "สัดส่วน (%)"],
        ]
        for cat_name, cat_data in data["expense_by_category"]:
            summary_data.append([
                f"{cat_data['icon']} {cat_name}",
                f"{cat_data['total']:,.2f}",
                str(cat_data["count"]),
                f"{cat_data['percentage']}%",
            ])
        summary_data.append([])
        summary_data.append(["── สรุปรายรับตามหมวดหมู่ ──"])
        summary_data.append(["หมวดหมู่", "ยอดรวม", "จำนวน", "สัดส่วน (%)"])
        for cat_name, cat_data in data["income_by_category"]:
            summary_data.append([
                f"{cat_data['icon']} {cat_name}",
                f"{cat_data['total']:,.2f}",
                str(cat_data["count"]),
                f"{cat_data['percentage']}%",
            ])
        summary_ws.update(range_name="A1", values=summary_data)

        # Tab 2: Raw Data
        raw_ws = sh.add_worksheet(title="รายการทั้งหมด (Raw Data)", rows=len(data["transactions"]) + 1, cols=8)
        raw_data = [["วันที่", "เวลา", "ประเภท", "จำนวนเงิน", "หมวดหมู่", "กระเป๋า", "โอนไปยัง", "บันทึก"]]
        for t in data["transactions"]:
            raw_data.append([
                t["date"], t["time"], t["type_label"],
                f"{t['amount']:,.2f}", t["category"],
                t["wallet"], t["to_wallet"], t["description"],
            ])
        raw_ws.update(range_name="A1", values=raw_data)

        # Make spreadsheet accessible
        sh.share(None, perm_type='anyone', role='reader')
        url = sh.url

        return {"url": url, "title": title, "message": "ส่งออกไป Google Sheets สำเร็จ"}

    except ImportError:
        raise HTTPException(status_code=500, detail="ไม่พบไลบรารี gspread กรุณาติดตั้ง: pip install gspread oauth2client")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาด: {str(e)}")


@router.get("/csv")
def export_csv(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020),
    db: Session = Depends(get_db),
):
    """Export data as CSV (fallback if Google Sheets is not configured)."""
    import csv

    data = _get_monthly_data(db, month, year)
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["วันที่", "เวลา", "ประเภท", "จำนวนเงิน", "หมวดหมู่", "กระเป๋า", "โอนไปยัง", "บันทึก"])
    for t in data["transactions"]:
        writer.writerow([
            t["date"], t["time"], t["type_label"],
            f"{t['amount']:.2f}", t["category"],
            t["wallet"], t["to_wallet"], t["description"],
        ])

    csv_bytes = output.getvalue().encode("utf-8-sig")
    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="report_{year}_{month:02d}.csv"'
        },
    )
