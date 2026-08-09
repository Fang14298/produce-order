# Design Spec: ระบบบันทึกออเดอร์ Google Sheet & LINE LIFF + Messaging API

**วันที่ออกแบบ**: 9 สิงหาคม 2026  
**อัปเดตล่าสุด**: 9 สิงหาคม 2026 (เพิ่มสเปก LINE LIFF ID + Messaging API Push Notification ครบวงจร)  
**โปรเจกต์**: ระบบสั่งผัก-ผลไม้ออนไลน์ (ร้านสวนผักสด) — `Fang14298/produce-order`  

---

## 1. ภาพรวมและวัตถุประสงค์ (Overview & Goals)

ยกระดับประสบการณ์การสั่งซื้อสินค้าให้เทียบเท่าแอปพลิเคชันระดับมืออาชีพ ด้วยการเชื่อมต่อ **LINE LIFF (LINE Front-end Framework)** และ **LINE Messaging API / LINE Notify**

**เป้าหมายหลัก**:
1. **อัตโนมัติ 100% สำหรับลูกค้า (LINE LIFF)**: เมื่อเปิดหน้าเว็บผ่าน LINE ระบบจะระบุตัวตนของลูกค้า (`lineUserId`, `lineDisplayName`) อัตโนมัติ เมื่อกดสั่งซื้อ ระบบสามารถส่งข้อความสั่งซื้อเข้าแชท LINE ของลูกค้าโดยตรงโดยลูกค้าไม่ต้องกดส่งซ้ำ
2. **การแจ้งเตือนเสียงเด้งเข้า LINE แอดมินร้าน (Admin Alert)**: ทันทีที่มีออเดอร์ใหม่ลง Google Sheet ระบบจะยิงข้อความสรุปออเดอร์เด้งเตือนใน LINE ของร้านค้า/กลุ่มแอดมินทันที 24 ชม.
3. **บันทึกตารางรวมศูนย์ (Google Sheet)**: บันทึกข้อมูลออเดอร์ครบถ้วนลงตาราง `"รายการออเดอร์"` ใน Google Sheet พร้อมบันทึก `LINE User ID` สำหรับติดต่อกลับ
4. **จำชื่อร้านค้าในเครื่อง (LocalStorage)**: จำชื่อร้านในโทรศัพท์ลูกค้า ไม่ต้องนั่งพิมพ์ใหม่ทุกครั้ง

---

## 2. สถาปัตยกรรมและการไหลของข้อมูล (Architecture & Data Flow)

```mermaid
sequenceDiagram
    autonumber
    actor Customer as ลูกค้า (สั่งผักใน LINE)
    participant LIFF as LINE LIFF SDK (index.html)
    participant GAS as Google Apps Script Webhook
    participant Sheet as Google Sheet (รายการออเดอร์)
    participant AdminLine as LINE ร้านค้า / แอดมิน
    participant CustomerLine as แชท LINE ของลูกค้า

    Customer->>LIFF: เปิดหน้าเว็บสั่งซื้อใน LINE
    LIFF-->>LIFF: ดึงข้อมูลโปรไฟล์ (lineUserId, displayName)
    Customer->>LIFF: เลือกผัก + กดปุ่ม "ส่งออเดอร์"
    par 1. บันทึกลง Sheet & แจ้งเตือนแอดมิน
        LIFF->>GAS: POST JSON (ออเดอร์ + lineUserId)
        GAS->>Sheet: เพิ่มแถวออเดอร์ใหม่ในตาราง "รายการออเดอร์"
        GAS->>AdminLine: ยิง LINE Push/Notify เตือนแอดมิน "🔔 มีออเดอร์ใหม่เข้า!"
        GAS->>CustomerLine: ยิงข้อความใบทวนออเดอร์เข้าแชทลูกค้า (Messaging API)
    and 2. ประสบการณ์ฝั่งลูกค้า
        LIFF->>CustomerLine: ส่งข้อความสั่งซื้อเข้าแชท LINE ทันที (liff.sendMessages)
        LIFF-->>Customer: ขึ้น Toast "ส่งออเดอร์เข้าแชท LINE เรียบร้อยแล้ว ✓"
    end
```

---

## 3. วิธีการตั้งค่า LINE LIFF และ Messaging API (Step-by-Step Guide)

### 3.1 ขั้นตอนขอ LIFF ID (เพื่อให้แชทลูกค้าได้รับข้อความทวนออเดอร์)
1. เข้าสู่ระบบ [LINE Developers Console](https://developers.line.biz/)
2. เลือก Provider ของร้านค้า หรือสร้างใหม่ -> เลือก **Provider: ร้านสวนผักสด**
3. สร้าง Channel ใหม่ประเภท **LINE Login**
4. ไปที่แท็บ **LIFF** -> กดปุ่ม **Add**
   - **LIFF app name**: สั่งผักสวนผักสด
   - **Size**: Full
   - **Endpoint URL**: `https://fang14298.github.io/produce-order/`
   - **Scopes**: เลือก `profile`, `openid`
   - **Bot prompt**: Aggressive หรือ Normal
5. กด **Add** แล้วคัดลอก **LIFF ID** (เช่น `2000123456-AbCdEfGh`) นำมาวางในตัวแปร `LIFF_ID` ในไฟล์ [`index.html`](file:///C:/Users/fang0/produce-order/index.html):
   ```javascript
   const LIFF_ID = "2000123456-AbCdEfGh";
   ```

### 3.2 ขั้นตอนขอ Channel Access Token (เพื่อให้ระบบยิงเด้งเตือนแอดมิน)
1. ใน [LINE Developers Console](https://developers.line.biz/) เลือก Channel ประเภท **Messaging API** (ของ LINE OA @746wpose)
2. ไปที่แท็บ **Messaging API** -> เลื่อนลงด้านล่างสุดที่ **Channel access token (long-lived)** -> กด **Issue**
3. คัดลอก Token ยาวๆ นำไปวางในไฟล์ [`examples/google-apps-script.gs`](file:///C:/Users/fang0/produce-order/examples/google-apps-script.gs):
   ```javascript
   var LINE_CHANNEL_ACCESS_TOKEN = "วาง_TOKEN_ยาวๆ_ที่นี่";
   ```
4. หากต้องการแจ้งเตือนเข้า LINE Notify ของร้าน สามารถนำ **LINE Notify Token** มาวางใน `ADMIN_LINE_NOTIFY_TOKEN` ได้เช่นกัน

---

## 4. รายละเอียดโครงสร้างข้อมูล JSON Payload

```json
{
  "shop": "ครัวริมปิง",
  "date": "2026-08-10",
  "note": "ขอมะเขือเทศลูกแข็ง",
  "totalAmount": 475,
  "items": [
    { "name": "คะน้า", "qty": 2, "unit": "กก.", "price": 40, "subtotal": 80 },
    { "name": "มะนาว", "qty": 15, "unit": "ลูก", "price": 3, "subtotal": 45 }
  ],
  "itemsSummary": "• คะน้า 2 กก. = 80 บาท\n• มะนาว 15 ลูก = 45 บาท",
  "lineUserId": "U1234567890abcdef1234567890abcdef",
  "lineDisplayName": "Somchai_Restaurant"
}
```

---

## 5. ผลการตรวจสอบความถูกต้อง (Verification)

1. **ตรวจสอบความถูกต้องของไวยากรณ์ JavaScript ใน `index.html`**:
   - ผ่านการตรวจสอบความถูกต้องด้วย Node.js `vm.Script` (Syntax Valid 100%)
2. **การรองรับ Fallback**:
   - หากยังไม่ได้ใส่ `LIFF_ID` หรือเปิดผ่านเบราว์เซอร์ปกติภายนอก LINE หน้าเว็บจะสลับไปใช้ระบบส่งข้อความมาตรฐาน (`line.me/R/oaMessage/...`) อัตโนมัติ โดยไม่พังและไม่แสดง Error
