/**
 * Google Apps Script for Produce Order Web App (ร้านสวนผักสด)
 * -------------------------------------------------------------
 * ฟีเจอร์:
 * 1. บันทึกออเดอร์ลงชีต "รายการออเดอร์" ใน Google Sheet อัตโนมัติ
 * 2. ส่งข้อความแจ้งเตือนออเดอร์ใหม่เด้งเข้า LINE แอดมินร้านค้า (LINE Messaging API / LINE Notify)
 * 3. ส่งข้อความยืนยันออเดอร์กลับเข้าแชท LINE ของลูกค้าโดยตรง (เมื่อเปิดผ่าน LINE LIFF)
 * 
 * วิธีใช้งาน:
 * 1. เปิด Google Sheet "ราคาระบบ / ตารางลูกค้า"
 * 2. ไปที่เมนู "ส่วนขยาย" (Extensions) > "Apps Script"
 * 3. วางโค้ดนี้ทั้งหมดลงในไฟล์ Code.gs
 * 4. (ไม่บังคับ) ใส่ค่า LINE_CHANNEL_ACCESS_TOKEN หรือ ADMIN_LINE_NOTIFY_TOKEN ถ้าต้องการแจ้งเตือนไลน์
 * 5. กดปุ่ม "ทำให้ใช้งานได้" (Deploy) > "จัดการการทําให้ใช้งานได้" (Manage Deployments) > แก้ไขเป็นเวอร์ชันใหม่
 */

// ================= ตั้งค่า LINE (ถ้ายังไม่ใส่ สามารถเว้นว่างไว้ได้ ระบบจะบันทึกชีตได้อย่างเดียว) =================
var LINE_CHANNEL_ACCESS_TOKEN = ""; // วาง Channel Access Token จาก LINE Developers Console
var ADMIN_LINE_NOTIFY_TOKEN = "";    // วาง LINE Notify Token ของแอดมินร้าน (ถ้ามี)
var ADMIN_LINE_USER_ID = "";         // หรือวาง LINE User ID ของแอดมินร้าน (ถ้าใช้ Messaging API)

function doPost(e) {
  var lock = LockService.getScriptLock();
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
        "สถานะ",
        "LINE User ID"
      ];
      sheet.appendRow(headers);
      
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#1E6B3C");
      headerRange.setFontColor("#FFFFFF");
      headerRange.setFontWeight("bold");
      headerRange.setFontFamily("Prompt");
      sheet.setRowHeight(1, 35);
      sheet.setFrozenRows(1);
    }
    
    var data = JSON.parse(e.postData.contents);
    
    var timestamp = new Date();
    var formattedTime = Utilities.formatDate(timestamp, "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss");
    var orderId = "ORD-" + Utilities.formatDate(timestamp, "Asia/Bangkok", "yyyyMMdd-HHmmss");
    
    var itemsSummary = "";
    if (Array.isArray(data.items)) {
      itemsSummary = data.items.map(function(item) {
        return item.name + " " + item.qty + " " + item.unit + " (" + item.price + "฿)";
      }).join("\n");
    } else {
      itemsSummary = data.itemsSummary || "";
    }
    
    var shopName = data.shop || "(ไม่ระบุชื่อร้าน)";
    var deliveryDate = data.date || "พรุ่งนี้";
    var totalAmount = data.totalAmount || 0;
    var note = data.note || "";
    var lineUserId = data.lineUserId || "";
    
    // 1. บันทึกลง Google Sheet
    sheet.appendRow([
      orderId,
      formattedTime,
      shopName,
      deliveryDate,
      itemsSummary,
      totalAmount,
      note,
      "รอยืนยัน",
      lineUserId
    ]);
    
    // ข้อความสรุปออเดอร์สำหรับแจ้งเตือน
    var receiptText = "🧾 ใบสั่งซื้อ — ร้านสวนผักสด\n" +
                      "เลขที่: " + orderId + "\n" +
                      "ร้าน: " + shopName + "\n" +
                      "รับของ: " + deliveryDate + "\n" +
                      "———————\n" +
                      itemsSummary + "\n" +
                      "———————\n" +
                      "💰 รวมทั้งสิ้น: " + totalAmount.toLocaleString() + " บาท";
    if (note) receiptText += "\n📝 หมายเหตุ: " + note;

    // 2. ส่งแจ้งเตือนหาแอดมินร้านค้า (LINE Notify หรือ Messaging API Push)
    var adminMessage = "🔔 มีออเดอร์ใหม่เข้ามา!\n" + receiptText;
    if (ADMIN_LINE_NOTIFY_TOKEN) {
      sendLineNotify(ADMIN_LINE_NOTIFY_TOKEN, adminMessage);
    }
    if (LINE_CHANNEL_ACCESS_TOKEN && ADMIN_LINE_USER_ID) {
      sendLinePushMessage(LINE_CHANNEL_ACCESS_TOKEN, ADMIN_LINE_USER_ID, adminMessage);
    }

    // 3. ส่งข้อความยืนยันเข้าแชท LINE ของลูกค้าโดยตรง (ถ้าส่ง lineUserId มา)
    if (LINE_CHANNEL_ACCESS_TOKEN && lineUserId) {
      var customerMessage = "ขอบคุณที่สั่งซื้อผัก-ผลไม้กับร้านสวนผักสดค่ะ 🙏\n" + receiptText;
      sendLinePushMessage(LINE_CHANNEL_ACCESS_TOKEN, lineUserId, customerMessage);
    }
    
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

// ฟังก์ชั่นส่ง LINE Notify
function sendLineNotify(token, message) {
  try {
    UrlFetchApp.fetch("https://notify-api.line.me/api/notify", {
      method: "post",
      headers: { "Authorization": "Bearer " + token },
      payload: { "message": message }
    });
  } catch (e) {
    console.warn("LINE Notify error:", e);
  }
}

// ฟังก์ชั่นส่ง LINE Messaging API Push Message
function sendLinePushMessage(channelToken, toUserId, messageText) {
  try {
    UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + channelToken
      },
      payload: JSON.stringify({
        to: toUserId,
        messages: [{ type: "text", text: messageText }]
      })
    });
  } catch (e) {
    console.warn("LINE Push error:", e);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Google Apps Script Webhook & LINE Bot Service for ร้านสวนผักสด is running online!");
}
