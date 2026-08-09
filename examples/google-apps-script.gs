/**
 * Google Apps Script for Produce Order Web App (ร้านสวนผักสด)
 * -------------------------------------------------------------
 * วิธีใช้งาน:
 * 1. เปิด Google Sheet "ราคาระบบ / ตารางลูกค้า"
 * 2. ไปที่เมนู "ส่วนขยาย" (Extensions) > "Apps Script"
 * 3. วางโค้ดนี้ทั้งหมดลงในไฟล์ Code.gs
 * 4. กดปุ่ม "ทำให้ใช้งานได้" (Deploy) > "การทําให้ใช้งานได้รายการใหม่" (New Deployment)
 * 5. เลือกประเภท: "เว็บแอป" (Web app)
 * 6. ตั้งค่า:
 *    - อธิบาย: ระบบรับออเดอร์ร้านสวนผักสด
 *    - ดำเนินการในฐานะ: ฉัน (Me)
 *    - ผู้ที่มีสิทธิ์เข้าถึง: ทุกคน (Anyone)
 * 7. กด "ทำให้ใช้งานได้" แล้วคัดลอก Web App URL นำไปวางใน SHEET_WEBHOOK_URL บน index.html
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  // ป้องกันการบันทึกพร้อมกันชนกัน (Wait up to 10 seconds)
  lock.tryLock(10000);
  
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = "รายการออเดอร์";
    var sheet = ss.getSheetByName(sheetName);
    
    // สร้างชีต "รายการออเดอร์" อัตโนมัติถ้ายังไม่มี
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      var headers = [
        "เลขที่ออเดอร์",
        "วัน-เวลาสั่งซื้อ",
        "ชื่อร้าน / ลูกค้า",
        "วันที่รับของ",
        "รายการสินค้าที่สั่ง",
        "ยอดรวม (บาท)",
        "หมายเหตุ",
        "สถานะ"
      ];
      sheet.appendRow(headers);
      
      // จัดรูปแบบหัวตาราง
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#1E6B3C");
      headerRange.setFontColor("#FFFFFF");
      headerRange.setFontWeight("bold");
      headerRange.setFontFamily("Prompt");
      sheet.setRowHeight(1, 35);
      sheet.setFrozenRows(1);
    }
    
    // แปลงข้อมูลที่ส่งมาเป็น JSON
    var data = JSON.parse(e.postData.contents);
    
    var timestamp = new Date();
    var formattedTime = Utilities.formatDate(timestamp, "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss");
    var orderId = "ORD-" + Utilities.formatDate(timestamp, "Asia/Bangkok", "yyyyMMdd-HHmmss");
    
    // เรียบเรียงรายการสินค้าให้อ่านง่าย
    var itemsSummary = "";
    if (Array.isArray(data.items)) {
      itemsSummary = data.items.map(function(item) {
        return item.name + " " + item.qty + " " + item.unit + " (" + item.price + "฿)";
      }).join("\n");
    } else {
      itemsSummary = data.itemsSummary || "";
    }
    
    // บันทึกแถวใหม่
    sheet.appendRow([
      orderId,
      formattedTime,
      data.shop || "(ไม่ระบุชื่อร้าน)",
      data.date || "พรุ่งนี้",
      itemsSummary,
      data.totalAmount || 0,
      data.note || "",
      "รอยืนยัน"
    ]);
    
    return ContentService
      .createTextOutput(JSON.stringify({ result: "success", orderId: orderId }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Google Apps Script Webhook for ร้านสวนผักสด is running online!");
}
