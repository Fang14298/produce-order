/**
 * Google Apps Script for Produce Order Web App (ร้านสวนผักสด)
 * -------------------------------------------------------------
 * ฟีเจอร์:
 * 1. บันทึกออเดอร์ลงชีต "รายการออเดอร์" ใน Google Sheet อัตโนมัติ
 * 2. ส่งข้อความแจ้งเตือนออเดอร์ใหม่เด้งเข้า LINE แอดมินร้านค้า (LINE Messaging API / LINE Notify)
 * 3. ส่งข้อความยืนยันออเดอร์กลับเข้าแชท LINE ของลูกค้าโดยตรง (Messaging API Push Message)
 * 
 * วิธีใช้งาน:
 * 1. เปิด Google Sheet "ราคาระบบ / ตารางลูกค้า"
 * 2. ไปที่เมนู "ส่วนขยาย" (Extensions) > "Apps Script"
 * 3. วางโค้ดนี้ทั้งหมดลงในไฟล์ Code.gs
 * 4. ระบุค่า LINE_CHANNEL_ACCESS_TOKEN และ ADMIN_LINE_USER_ID (LINE User ID ของแอดมิน)
 * 5. กดปุ่ม "ทำให้ใช้งานได้" (Deploy) > "จัดการการทำให้ใช้งานได้" (Manage Deployments) > แก้ไขเป็น "เวอร์ชันใหม่" (New Version)
 */

// ================= ตั้งค่า LINE Messaging API / LINE Notify =================
var LINE_CHANNEL_ACCESS_TOKEN = "/ZSNTT8339UJqvXWWQh7fLKBitoZeH7xUFj9+X92XCbewBkFXaUVx8+NZUoUiUMLzvfKu6hLux+EKGFcgtXKtYoLKRJBndcULx1g+EDXdI4NiBdTqNe4U5xEdSmlXJ8oqZrqlYpJumD5w0viHChkPAdB04t89/1O/w1cDnyilFU="; 
var ADMIN_LINE_USER_ID = "U2f4e0d8f6e656dbaa7788c3ac1363675";         // ⚠️ วาง LINE User ID ของแอดมินร้านค้าที่นี่ (เช่น U1234567890abcdef...) เพื่อรับการแจ้งเตือน
var ADMIN_LINE_NOTIFY_TOKEN = "";    // (ไม่บังคับ) วาง LINE Notify Token ของแอดมินร้าน (ถ้าใช้ LINE Notify)

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
        "ที่อยู่จัดส่ง",
        "เลขผู้เสียภาษี",
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
    
    if (!e || !e.postData || !e.postData.contents) {
      Logger.log("doPost ถูกเรียกใช้โดยตรงโดยไม่มี payload (ข้อมูล e.postData เป็น undefined)");
      return ContentService
        .createTextOutput(JSON.stringify({
          result: "warning",
          message: "ฟังก์ชั่น doPost จะทำงานเมื่อได้รับคำขอ HTTP POST จากหน้าเว็บเท่านั้น หากต้องการทดสอบใน Apps Script โปรดเลือกฟังก์ชั่น testDoPost แล้วกด 'เรียกใช้'"
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = JSON.parse(e.postData.contents);
    
    var timestamp = new Date();
    var formattedTime = Utilities.formatDate(timestamp, "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss");
    var orderId = "ORD-" + Utilities.formatDate(timestamp, "Asia/Bangkok", "yyyyMMdd-HHmmss");
    
    var itemsSummary = "";
    if (Array.isArray(data.items)) {
      itemsSummary = data.items.map(function(item) {
        return "• " + item.name + " " + item.qty + " " + item.unit + " = " + item.subtotal + " บาท";
      }).join("\n");
    } else {
      itemsSummary = data.itemsSummary || "";
    }
    
    var shopName = data.shop || "(ไม่ระบุชื่อร้าน)";
    var address = data.address || "(ไม่ระบุที่อยู่)";
    var taxId = data.taxId || "-";
    var deliveryDate = cleanDateText(data.date);
    var totalAmount = data.totalAmount || 0;
    var note = data.note || "";
    var lineUserId = data.lineUserId || "";
    
    // 1. บันทึกลง Google Sheet (แทรกบรรทัดใหม่ไว้ด้านบนสุด แถวที่ 2 ต่อจากหัวตาราง)
    var newRowData = [
      orderId,
      formattedTime,
      shopName,
      address,
      taxId,
      deliveryDate,
      itemsSummary,
      totalAmount,
      note,
      "รอยืนยัน",
      lineUserId
    ];
    sheet.insertRowBefore(2);
    sheet.getRange(2, 1, 1, newRowData.length).setValues([newRowData]);
    
    // ข้อความสรุปออเดอร์สำหรับแจ้งเตือน
    var receiptText = "🧾 ใบสั่งซื้อ — ร้านสวนผักสด\n" +
                      "เลขที่: " + orderId + "\n" +
                      "ชื่อลูกค้า: " + shopName + "\n" +
                      "ที่อยู่จัดส่ง: " + address + "\n";
    if (taxId && taxId !== "-") receiptText += "เลขผู้เสียภาษี: " + taxId + "\n";
    receiptText += "วันรับของ: " + deliveryDate + "\n" +
                   "———————\n" +
                   itemsSummary + "\n" +
                   "———————\n" +
                   "💰 รวมทั้งสิ้น: " + Number(totalAmount).toLocaleString("th-TH") + " บาท";
    if (note) receiptText += "\n📝 หมายเหตุ: " + note;

    // 2. ส่งแจ้งเตือนหาแอดมินร้านค้า (LINE Notify หรือ Messaging API Push)
    var adminMessage = "🔔 มีออเดอร์ใหม่เข้ามา!\n" + receiptText;
    if (ADMIN_LINE_NOTIFY_TOKEN) {
      sendLineNotify(ADMIN_LINE_NOTIFY_TOKEN, adminMessage);
    }
    if (LINE_CHANNEL_ACCESS_TOKEN && ADMIN_LINE_USER_ID) {
      sendLinePushMessage(LINE_CHANNEL_ACCESS_TOKEN, ADMIN_LINE_USER_ID, adminMessage);
    }

    // 3. ส่งข้อความยืนยันเข้าแชท LINE ของลูกค้าโดยตรง (ถ้าเปิดผ่าน LIFF / มี lineUserId)
    if (LINE_CHANNEL_ACCESS_TOKEN && lineUserId) {
      var customerMessage = "ขอบคุณที่สั่งซื้อผัก-ผลไม้กับร้านสวนผักสดค่ะ 🙏\nระบบได้รับออเดอร์เรียบร้อยแล้วค่ะ\n\n" + receiptText;
      sendLinePushMessage(LINE_CHANNEL_ACCESS_TOKEN, lineUserId, customerMessage);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({ result: "success", orderId: orderId }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log("doPost Error: " + error.toString());
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
      payload: { "message": message },
      muteHttpExceptions: true
    });
  } catch (e) {
    Logger.log("LINE Notify error: " + e.toString());
  }
}

// ฟังก์ชั่นส่ง LINE Messaging API Push Message
function sendLinePushMessage(channelToken, toUserId, messageText) {
  try {
    var response = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + channelToken
      },
      payload: JSON.stringify({
        to: toUserId,
        messages: [{ type: "text", text: messageText }]
      }),
      muteHttpExceptions: true
    });
    Logger.log("LINE Push (" + toUserId + ") Response: " + response.getResponseCode() + " " + response.getContentText());
  } catch (e) {
    Logger.log("LINE Push error: " + e.toString());
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Google Apps Script Webhook & LINE Bot Service for ร้านสวนผักสด is running online!");
}

// ฟังก์ชั่นสำหรับกดทดสอบระบบในเมนู Apps Script IDE (เลือก testDoPost แล้วกด 'เรียกใช้')
function testDoPost() {
  var mockEvent = {
    postData: {
      contents: JSON.stringify({
        shop: "ร้านทดสอบ (Apps Script IDE)",
        address: "99/99 อาคารทดสอบ ถนนสุขุมวิท กทม.",
        taxId: "0105559999999",
        date: "พรุ่งนี้",
        note: "ทดสอบกดจาก Apps Script",
        totalAmount: 150,
        items: [
          { name: "คะน้า", qty: 2, unit: "กก.", price: 40, subtotal: 80 },
          { name: "เห็ดฟาง", qty: 1, unit: "กก.", price: 70, subtotal: 70 }
        ],
        itemsSummary: "• คะน้า 2 กก. = 80 บาท\n• เห็ดฟาง 1 กก. = 70 บาท",
        lineUserId: ADMIN_LINE_USER_ID,
        lineDisplayName: "Test Admin"
      })
    }
  };
  var result = doPost(mockEvent);
  Logger.log("Test Result: " + result.getContent());
}

/**
 * ฟังก์ชั่น ทริกเกอร์อัตโนมัติเมื่อแอดมินแก้ไขข้อมูลใน Google Sheet (Installable / Simple Trigger)
 * เมื่อแอดมินเปลี่ยนค่าในคอลัมน์ "สถานะ" (คอลัมน์ J = 10)
 * สคริปต์จะอ่าน LINE User ID ในคอลัมน์ K (คอลัมน์ 11) แล้วส่งข้อความแจ้งเตือนหาลูกค้าทาง LINE Messaging API
 */
function onEditStatus(e) {
  try {
    if (!e || !e.range) return;
    
    var sheet = e.range.getSheet();
    if (sheet.getName() !== "รายการออเดอร์") return;
    
    var row = e.range.getRow();
    var col = e.range.getColumn();
    
    // คอลัมน์ J = 10 (สถานะ) ข้ามแถวที่ 1 (หัวตาราง)
    if (row <= 1 || col !== 10) return;
    
    var newStatus = String(e.value || "").trim();
    var oldStatus = String(e.oldValue || "").trim();
    if (!newStatus || newStatus === oldStatus) return;
    
    // อ่านข้อมูลทั้งแถวแบบแสดงผล [orderId, formattedTime, shopName, address, taxId, deliveryDate, itemsSummary, totalAmount, note, status, lineUserId]
    var displayValues = sheet.getRange(row, 1, 1, 11).getDisplayValues()[0];
    var rawValues = sheet.getRange(row, 1, 1, 11).getValues()[0];
    
    var orderId = displayValues[0] || rawValues[0];
    var shopName = displayValues[2] || "ลูกค้า";
    var rawDate = displayValues[5] || rawValues[5];
    var deliveryDate = cleanDateText(rawDate);
    var lineUserId = String(displayValues[10] || rawValues[10]).trim();
    
    if (!lineUserId) {
      Logger.log("ไม่มี LINE User ID ในแถวที่ " + row + " — ข้ามการยิงแจ้งเตือน");
      return;
    }
    
    var messageText = "";
    if (newStatus === "ยืนยันแล้ว") {
      messageText = "🟢 อัปเดตสถานะออเดอร์ #" + orderId + "\n" +
                    "ร้านสวนผักสดได้ \"ยืนยันออเดอร์\" ของคุณ (" + shopName + ") เรียบร้อยแล้วค่ะ 🙏\n" +
                    "วันรับของ: " + deliveryDate + "\n" +
                    "ขอบพระคุณที่อุดหนุนค่ะ ❤️";
    } else if (newStatus === "กำลังจัดส่ง") {
      messageText = "🚚 ออเดอร์ของคุณกำลังเดินทาง! #" + orderId + "\n" +
                    "ออเดอร์ของร้าน " + shopName + " กำลังถูกนำส่งไปยังที่อยู่จัดส่งเรียบร้อยแล้วค่ะ\n" +
                    "โปรดเตรียมรอรับสินค้าได้เลยค่ะ 🥬";
    } else if (newStatus === "จัดส่งเรียบร้อย") {
      messageText = "✅ จัดส่งสำเร็จแล้ว! #" + orderId + "\n" +
                    "ออเดอร์ของร้าน " + shopName + " จัดส่งเรียบร้อยแล้วค่ะ\n" +
                    "ขอบคุณที่ไว้วางใจร้านสวนผักสดนะคะ 🙏❤️";
    } else if (newStatus === "ยกเลิก" || newStatus === "ยกเลิกออเดอร์") {
      messageText = "❌ อัปเดตสถานะออเดอร์ #" + orderId + "\n" +
                    "ออเดอร์ของคุณได้ถูกยกเลิกแล้วค่ะ\n" +
                    "หากมีข้อสงสัยเพิ่มเติม สามารถสอบถามแอดมินทางแชทนี้ได้เลยค่ะ";
    } else {
      messageText = "🔔 อัปเดตสถานะออเดอร์ #" + orderId + "\n" +
                    "สถานะปัจจุบัน: " + newStatus + "\n" +
                    "ขอบคุณที่ใช้บริการร้านสวนผักสดค่ะ 🙏";
    }
    
    if (LINE_CHANNEL_ACCESS_TOKEN && lineUserId) {
      sendLinePushMessage(LINE_CHANNEL_ACCESS_TOKEN, lineUserId, messageText);
      Logger.log("ยิงข้อความอัปเดตสถานะ '" + newStatus + "' หา LINE User ID: " + lineUserId + " สำเร็จ");
    }
  } catch (err) {
    Logger.log("onEditStatus Error: " + err.toString());
  }
}

// ฟังก์ชั่นสำหรับกดทดสอบการยิงแจ้งเตือนเมื่อเปลี่ยนสถานะใน Apps Script IDE (เลือก testOnEditStatus แล้วกด 'เรียกใช้')
function testOnEditStatus() {
  if (!ADMIN_LINE_USER_ID) {
    Logger.log("⚠️ กรุณาระบุ ADMIN_LINE_USER_ID ก่อนทดสอบ");
    return;
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss ? ss.getSheetByName("รายการออเดอร์") : null;
  if (!sheet) {
    Logger.log("⚠️ ไม่พบชีต 'รายการออเดอร์' ในไฟล์นี้ (โปรดสร้างชีตหรือส่งออเดอร์แรกก่อน)");
    return;
  }
  var mockEvent = {
    range: {
      getSheet: function() { return sheet; },
      getRow: function() { return 2; },
      getColumn: function() { return 10; }
    },
    value: "กำลังจัดส่ง",
    oldValue: "รอยืนยัน"
  };
  onEditStatus(mockEvent);
}

// ฟังก์ชั่นจัดการจัดรูปแบบข้อความวันที่ให้อ่านง่าย รูปแบบ วัน/เดือน/ปี (dd/MM/yyyy)
function cleanDateText(val) {
  if (!val) return "พรุ่งนี้";
  var str = String(val).trim();
  
  // 1. หากเป็น DD/MM/YYYY อยู่แล้ว ให้คืนค่าเลย
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    return str;
  }
  
  // 2. หากเป็น YYYY-MM-DD เช่น 2026-08-11 -> แปลงเป็น 11/08/2026
  var matchISO = str.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (matchISO) {
    return matchISO[3] + "/" + matchISO[2] + "/" + matchISO[1];
  }
  
  // 3. หากเป็น Date Object หรือ สตริง Date สากลยาวๆ
  try {
    var d = new Date(val);
    if (!isNaN(d.getTime())) {
      return Utilities.formatDate(d, "GMT+7", "dd/MM/yyyy");
    }
  } catch (e) {}
  return str;
}
