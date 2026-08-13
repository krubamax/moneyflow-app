/**
 * Export Page Module
 * PDF and Google Sheets export with month/year selection.
 */
const ExportPage = (() => {
    const THAI_MONTHS_FULL = [
        '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
    ];

    function render(container) {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        container.innerHTML = `
            <div class="page-header">
                <h1>📤 ส่งออกข้อมูล</h1>
                <p>ส่งออกรายงานรายรับ-รายจ่ายเป็น PDF, CSV หรือ Google Sheets</p>
            </div>

            <div class="filter-bar" style="margin-bottom:24px;">
                <label style="font-weight:600;color:var(--text-secondary);font-size:14px;">เลือกเดือน/ปี:</label>
                <select class="form-control" id="exportMonth" style="min-width:140px">
                    ${Array.from({length: 12}, (_, i) => `<option value="${i+1}" ${i+1===month?'selected':''}>${THAI_MONTHS_FULL[i+1]}</option>`).join('')}
                </select>
                <select class="form-control" id="exportYear" style="min-width:100px">
                    ${Array.from({length: 5}, (_, i) => {
                        const y = year - 2 + i;
                        return `<option value="${y}" ${y===year?'selected':''}>${y}</option>`;
                    }).join('')}
                </select>
            </div>

            <div class="export-grid">
                <!-- PDF Export -->
                <div class="card export-card">
                    <div class="export-icon">📄</div>
                    <h3>ส่งออก PDF</h3>
                    <p>
                        ดาวน์โหลดรายงานสรุปรายรับ-รายจ่ายเป็นไฟล์ PDF<br>
                        พร้อมตารางสรุปตามหมวดหมู่และรายการทั้งหมด
                    </p>
                    <button class="btn btn-primary" id="exportPdfBtn" style="width:100%;">
                        <span class="material-icons-round" style="font-size:18px">picture_as_pdf</span>
                        ดาวน์โหลด PDF
                    </button>
                    <div class="text-xs text-muted mt-sm">
                        รองรับ: สรุปยอดรวม, ตารางหมวดหมู่, Transaction log
                    </div>
                </div>

                <!-- CSV Export -->
                <div class="card export-card">
                    <div class="export-icon">📊</div>
                    <h3>ส่งออก CSV</h3>
                    <p>
                        ดาวน์โหลดข้อมูลดิบเป็นไฟล์ CSV สำหรับนำไปใช้<br>
                        ใน Excel หรือ Google Sheets ต่อเอง
                    </p>
                    <button class="btn btn-success" id="exportCsvBtn" style="width:100%;">
                        <span class="material-icons-round" style="font-size:18px">table_chart</span>
                        ดาวน์โหลด CSV
                    </button>
                    <div class="text-xs text-muted mt-sm">
                        เปิดได้ทันทีใน Excel, Google Sheets, Numbers
                    </div>
                </div>

                <!-- Google Sheets Export -->
                <div class="card export-card">
                    <div class="export-icon">📋</div>
                    <h3>ส่งออก Google Sheets</h3>
                    <p>
                        สร้าง Google Spreadsheet อัตโนมัติพร้อม 2 Tab:<br>
                        สรุป (Summary) + รายการทั้งหมด (Raw Data)
                    </p>
                    <button class="btn btn-ghost" id="exportSheetsBtn" style="width:100%;">
                        <span class="material-icons-round" style="font-size:18px">cloud_upload</span>
                        ส่งออกไป Google Sheets
                    </button>
                    <div class="text-xs text-muted mt-sm">
                        ⚠️ ต้องตั้งค่า Google Service Account ก่อนใช้งาน
                    </div>
                </div>
            </div>

            <!-- Export History / Status -->
            <div class="card" style="margin-top:24px;">
                <h3 style="font-size:16px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:8px;">
                    <span class="material-icons-round">info</span> คำแนะนำ
                </h3>
                <div style="font-size:13px;color:var(--text-secondary);line-height:1.8;">
                    <p>📄 <strong>PDF</strong> — เหมาะสำหรับเก็บรายงานสรุปรายเดือน พิมพ์ หรือแชร์ให้ผู้อื่นดู</p>
                    <p>📊 <strong>CSV</strong> — เหมาะสำหรับนำไปวิเคราะห์ต่อใน Excel หรือทำ Pivot Table เอง</p>
                    <p>📋 <strong>Google Sheets</strong> — เหมาะสำหรับทำงานร่วมกับผู้อื่น หรือสร้างกราฟเพิ่มเติมบน Cloud</p>
                </div>
            </div>
        `;

        // Event listeners
        document.getElementById('exportPdfBtn').addEventListener('click', () => {
            const month = document.getElementById('exportMonth').value;
            const year = document.getElementById('exportYear').value;
            App.showToast(`กำลังสร้าง PDF สำหรับ ${THAI_MONTHS_FULL[month]} ${year}...`, 'info');
            API.exportPdf(month, year);
        });

        document.getElementById('exportCsvBtn').addEventListener('click', () => {
            const month = document.getElementById('exportMonth').value;
            const year = document.getElementById('exportYear').value;
            App.showToast(`กำลังสร้าง CSV สำหรับ ${THAI_MONTHS_FULL[month]} ${year}...`, 'info');
            API.exportCsv(month, year);
        });

        document.getElementById('exportSheetsBtn').addEventListener('click', async () => {
            const month = document.getElementById('exportMonth').value;
            const year = document.getElementById('exportYear').value;
            try {
                App.showToast('กำลังส่งออกไป Google Sheets...', 'info');
                const result = await API.exportSheets(month, year);
                App.showToast('ส่งออกสำเร็จ!', 'success');
                if (result.url) {
                    window.open(result.url, '_blank');
                }
            } catch (err) {
                App.showToast(err.message, 'error');
            }
        });
    }

    return { render };
})();
