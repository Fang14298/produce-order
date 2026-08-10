# ระบบบันทึกออเดอร์ลง Google Sheet อัตโนมัติ & จำชื่อร้านค้า/ที่อยู่/เลขผู้เสียภาษี Implementation Plan

> **Status:** ✅ Completed & Verified  
> **Last Updated:** 10 สิงหาคม 2026

**Goal:** เพิ่มระบบจำชื่อร้านค้า ที่อยู่จัดส่ง (บังคับ) และเลขประจำตัวผู้เสียภาษี (ไม่บังคับ) ลงใน LocalStorage ของเบราว์เซอร์, เพิ่มระบบดึงราคาสดจาก Google Sheet GViz API, บันทึกออเดอร์ลง Google Sheet อัตโนมัติ (ผ่าน Google Apps Script Webhook), และยิงแจ้งเตือนผ่าน LINE Messaging API (Dual Push ทั้งฝั่งแอดมินและลูกค้า)

**Architecture:** 
- ใน `index.html` อ่าน/บันทึกค่าชื่อร้าน ที่อยู่ และเลขผู้เสียภาษีผ่าน `localStorage` (`produce_order_shop_name`, `produce_order_address`, `produce_order_tax_id`)
- ฟังก์ชั่น `postOrderToSheet(orderPayload)` ส่งข้อมูลออเดอร์รวมถึง `address` และ `taxId` เข้า Google Apps Script Webhook
- ฟังก์ชั่น `submitOrder()` ทำงานแบบเบื้องหลัง: บันทึกข้อมูลลง LocalStorage + ยิง Webhook เข้า Google Sheet + รีเซ็ตตะกร้าสินค้า + แสดง Toast แจ้งเตือน
- Google Apps Script ใช้งาน `LockService` จัดการ Concurrency และบันทึกลง Google Sheet ตาราง 11 คอลัมน์ (A-K) พร้อมยิง LINE Messaging API Push Messages หาแอดมินร้านและส่งใบทวนออเดอร์กลับหาลูกค้า

**Tech Stack:** HTML5, Vanilla JavaScript (ES6+), LINE LIFF SDK, LocalStorage API, Fetch API (GViz + Webhook), Google Apps Script (Messaging API)

## Global Constraints

- **Color Scheme**: `light only` (คงเดิม)
- **Cutoff Time**: `19:00 น.` (คงเดิม)
- **Minimum Delivery Date**: `วันพรุ่งนี้` (คงเดิม + iOS Auto Fix Event Listener)
- **Validation**:
  - ชื่อร้านค้า (`*`) — บังคับกรอก
  - ที่อยู่จัดส่ง (`*`) — บังคับกรอก
  - เลขประจำตัวผู้เสียภาษี — ไม่บังคับกรอก (จำลง LocalStorage เมื่อมีการกรอก)
- **LINE OA URL / LIFF**: Integrated via LINE LIFF ID `2011037440-PBPwdRGn`

---

### Task 1: เพิ่มระบบจำชื่อร้านค้า ที่อยู่จัดส่ง และเลขผู้เสียภาษีด้วย LocalStorage

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `<input id="shop">`, `<textarea id="address">`, `<input id="taxId">` elements in DOM
- Produces: `saveSavedFields()`, `loadSavedFields()` in `index.html`

- [x] **Step 1: เพิ่มฟังก์ชั่น `loadSavedFields()` และ `saveSavedFields()`**

```javascript
const SHOP_STORAGE_KEY = "produce_order_shop_name";
const ADDRESS_STORAGE_KEY = "produce_order_address";
const TAX_ID_STORAGE_KEY = "produce_order_tax_id";

function loadSavedFields(){
  try{
    const savedShop = localStorage.getItem(SHOP_STORAGE_KEY);
    if(savedShop && document.getElementById("shop")) document.getElementById("shop").value = savedShop;
    const savedAddress = localStorage.getItem(ADDRESS_STORAGE_KEY);
    if(savedAddress && document.getElementById("address")) document.getElementById("address").value = savedAddress;
    const savedTaxId = localStorage.getItem(TAX_ID_STORAGE_KEY);
    if(savedTaxId && document.getElementById("taxId")) document.getElementById("taxId").value = savedTaxId;
  }catch(e){}
}
function saveSavedFields(){
  try{
    const shopVal = document.getElementById("shop") ? document.getElementById("shop").value.trim() : "";
    if(shopVal) localStorage.setItem(SHOP_STORAGE_KEY, shopVal);
    const addressVal = document.getElementById("address") ? document.getElementById("address").value.trim() : "";
    if(addressVal) localStorage.setItem(ADDRESS_STORAGE_KEY, addressVal);
    const taxIdVal = document.getElementById("taxId") ? document.getElementById("taxId").value.trim() : "";
    if(taxIdVal) localStorage.setItem(TAX_ID_STORAGE_KEY, taxIdVal); else localStorage.removeItem(TAX_ID_STORAGE_KEY);
  }catch(e){}
}
```

- [x] **Step 2: เรียกใช้ `loadSavedFields()` ในช่วง `init` และผูก event listener `input` บนช่อง `#shop`, `#address`, `#taxId`**

```javascript
["shop","address","taxId"].forEach(id => {
  const el = document.getElementById(id);
  if(el) el.addEventListener("input", saveSavedFields);
});
```

- [x] **Step 3: ตรวจสอบการทำงานของ LocalStorage**

- [x] **Step 4: Commit**

---

### Task 2: เพิ่มฟังก์ชั่น `postOrderToSheet()` ส่งออเดอร์รวมที่อยู่และเลขผู้เสียภาษีเข้า Webhook

**Files:**
- Modify: `index.html`, `examples/google-apps-script.gs`

**Interfaces:**
- Consumes: `cart`, `PRODUCTS`, `#shop`, `#address`, `#taxId`, `#date`, `#note`, `liffProfile`
- Produces: `buildOrderPayload()`, `postOrderToSheet()`, Google Apps Script Sheet 11 Columns

- [x] **Step 1: อัปเดต `buildOrderPayload()` ใน `index.html`**

```javascript
function buildOrderPayload(){
  return {
    shop: document.getElementById("shop").value.trim() || "(ไม่ระบุชื่อร้าน)",
    address: document.getElementById("address").value.trim() || "(ไม่ระบุที่อยู่)",
    taxId: document.getElementById("taxId").value.trim(),
    date: document.getElementById("date").value || "พรุ่งนี้",
    note: document.getElementById("note").value.trim(),
    totalAmount: cartTotal(),
    items: items,
    itemsSummary: itemsSummary.trim(),
    lineUserId: liffProfile ? liffProfile.userId : "",
    lineDisplayName: liffProfile ? liffProfile.displayName : ""
  };
}
```

- [x] **Step 2: อัปเดต Google Apps Script (`examples/google-apps-script.gs`)**
  - เพิ่มคอลัมน์ `"ที่อยู่จัดส่ง"` และ `"เลขผู้เสียภาษี"` ใน `headers`
  - บันทึกลงตาราง และใส่ที่อยู่/เลขผู้เสียภาษีลงในข้อความแจ้งเตือน `receiptText`

- [x] **Step 3: Commit**

---

### Task 3: ปรับแต่งระบบตรวจสอบข้อมูล (`validateOrder()`)

**Files:**
- Modify: `index.html`

- [x] **Step 1: บังคับกรอกที่อยู่จัดส่งใน `validateOrder()`**

```javascript
function validateOrder(){
  const shopInput = document.getElementById("shop");
  if(!shopInput.value.trim()){
    shopInput.focus();
    toast("กรุณากรอกชื่อร้าน/ลูกค้าก่อนส่งออเดอร์");
    return false;
  }
  const addressInput = document.getElementById("address");
  if(!addressInput.value.trim()){
    addressInput.focus();
    toast("กรุณากรอกที่อยู่จัดส่งก่อนส่งออเดอร์");
    return false;
  }
  const dateInput = document.getElementById("date");
  if(!dateInput.value || dateInput.value < dateInput.min){
    dateInput.focus();
    toast("กรุณาเลือกวันที่รับของตั้งแต่พรุ่งนี้เป็นต้นไป");
    return false;
  }
  return true;
}
```

- [x] **Step 2: Commit**

---

### Task 4: ตรวจสอบและรับรองความถูกต้อง (Verification)

**Files:**
- Modify: `index.html`, `examples/google-apps-script.gs`, `README.md`, `docs/superpowers/specs/`, `docs/superpowers/plans/`

- [x] **Step 1: ตรวจสอบความถูกต้องของไวยากรณ์ JavaScript ใน `index.html`** (ผ่านการตรวจสอบ 100%)
- [x] **Step 2: ทดสอบจำลองการส่งออเดอร์และการอ่าน LocalStorage สำหรับ 3 ฟิลด์**
- [x] **Step 3: อัปเดตเอกสารทั้งหมด (`README.md`, `specs/`, `plans/`) ให้สอดคล้องกัน**
