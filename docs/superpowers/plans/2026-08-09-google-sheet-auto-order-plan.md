# ระบบบันทึกออเดอร์ลง Google Sheet อัตโนมัติ & จำชื่อร้านค้า Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มระบบจำชื่อร้านค้าลงใน LocalStorage ของเบราว์เซอร์ และเพิ่มระบบบันทึกออเดอร์ลง Google Sheet อัตโนมัติ (ผ่าน Google Apps Script Webhook) เมื่อลูกค้ากดส่งออเดอร์ทาง LINE

**Architecture:** 
- ใน `index.html` อ่าน/บันทึกค่าชื่อร้านจาก `localStorage.getItem('produce_order_shop_name')` / `setItem`
- เพิ่มฟังก์ชั่น `postOrderToSheet(orderPayload)` ใช้ `fetch(SHEET_WEBHOOK_URL, ...)` ในโหมด `no-cors` เพื่อส่งข้อมูลออเดอร์เข้า Google Apps Script Webhook โดยไม่บล็อกการทำงานหลัก
- ปรับฟังก์ชั่น `sendLine()` และ `copyOrder()` ให้เรียก `postOrderToSheet()` เบื้องหลังก่อนเปิด URL LINE

**Tech Stack:** HTML5, Vanilla JavaScript (ES6+), LocalStorage API, Fetch API, Google Apps Script

## Global Constraints

- **Color Scheme**: `light only` (คงเดิม)
- **Cutoff Time**: `19:00 น.` (คงเดิม)
- **Minimum Delivery Date**: `วันพรุ่งนี้` (คงเดิม)
- **Validation**: ชื่อร้านเป็นช่องบังคับ (`*`)
- **LINE OA URL**: `https://line.me/R/oaMessage/%40746wpose/?`

---

### Task 1: เพิ่มระบบจำชื่อร้านค้าด้วย LocalStorage

**Files:**
- Modify: `index.html:346-380`, `index.html:420-438`

**Interfaces:**
- Consumes: `<input id="shop">` element in DOM
- Produces: `saveShopName()`, `loadShopName()` in `index.html`

- [ ] **Step 1: เพิ่มฟังก์ชั่น `loadShopName()` และ `saveShopName()`**

```javascript
const SHOP_STORAGE_KEY = "produce_order_shop_name";

function loadShopName() {
  const saved = localStorage.getItem(SHOP_STORAGE_KEY);
  if (saved) {
    const shopInput = document.getElementById("shop");
    if (shopInput) shopInput.value = saved;
  }
}

function saveShopName(val) {
  if (val && val.trim()) {
    localStorage.setItem(SHOP_STORAGE_KEY, val.trim());
  }
}
```

- [ ] **Step 2: เรียกใช้ `loadShopName()` ในช่วง `init` และผูก event listener `onchange` / `oninput` บนช่อง `#shop`**

```javascript
document.getElementById("shop").addEventListener("input", function() {
  saveShopName(this.value);
});
```

- [ ] **Step 3: ตรวจสอบการทำงานของ LocalStorage**

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add LocalStorage memory for shop name"
```

---

### Task 2: เพิ่มฟังก์ชั่น `postOrderToSheet()` ส่งออเดอร์เข้า Google Apps Script Webhook

**Files:**
- Modify: `index.html:180-186`, `index.html:333-360`

**Interfaces:**
- Consumes: `cart`, `PRODUCTS`, `#shop`, `#date`, `#note`
- Produces: `SHEET_WEBHOOK_URL`, `postOrderToSheet(payload)`

- [ ] **Step 1: เพิ่มตัวแปร `SHEET_WEBHOOK_URL` ในหมวด config**

```javascript
/* ================= config ================= */
const SHEET_ID = "1ihPCg3VKhS59B5RrlKuvFZi9IsZesESkXmrb02cS-84";
// วาง Web App URL ที่ได้จากการ Deploy Google Apps Script ในเครื่องหมายคำพูดด้านล่าง
const SHEET_WEBHOOK_URL = ""; 
```

- [ ] **Step 2: สร้างฟังก์ชั่น `postOrderToSheet()` ใน `index.html`**

```javascript
function buildOrderPayload() {
  const shop = document.getElementById("shop").value.trim() || "(ไม่ระบุชื่อร้าน)";
  const date = document.getElementById("date").value || "พรุ่งนี้";
  const note = document.getElementById("note").value.trim();
  
  const items = Object.entries(cart).map(([n, q]) => {
    const p = find(n);
    return {
      name: n,
      qty: q,
      unit: p.u,
      price: p.p,
      subtotal: p.p * q
    };
  });
  
  let itemsSummary = "";
  for (const [n, q] of Object.entries(cart)) {
    const p = find(n);
    itemsSummary += `• ${n} ${fmt(q)} ${p.u} = ${p.p * q} บาท\n`;
  }
  
  return {
    shop: shop,
    date: date,
    note: note,
    totalAmount: cartTotal(),
    items: items,
    itemsSummary: itemsSummary.trim()
  };
}

function postOrderToSheet() {
  if (!SHEET_WEBHOOK_URL) {
    console.log("ยังไม่ได้ตั้งค่า SHEET_WEBHOOK_URL — ข้ามการส่งเข้า Google Sheet");
    return;
  }
  
  const payload = buildOrderPayload();
  
  try {
    fetch(SHEET_WEBHOOK_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    }).then(() => {
      console.log("ส่งข้อมูลออเดอร์เข้า Google Sheet เรียบร้อยแล้ว");
    }).catch(err => {
      console.warn("ไม่สามารถส่งออเดอร์เข้า Google Sheet ได้:", err);
    });
  } catch (e) {
    console.warn("เกิดข้อผิดพลาดในการเรียก Webhook:", e);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add postOrderToSheet function for GAS webhook integration"
```

---

### Task 3: ปรับแต่ง `sendLine()` และ `copyOrder()` ให้รองรับ Dual Action

**Files:**
- Modify: `index.html:361-375`

**Interfaces:**
- Consumes: `validateOrder()`, `saveShopName()`, `postOrderToSheet()`
- Produces: Updated `sendLine()` and `copyOrder()`

- [ ] **Step 1: ปรับปรุง `sendLine()`**

```javascript
function sendLine() {
  if (!validateOrder()) return;
  const shopName = document.getElementById("shop").value.trim();
  saveShopName(shopName);
  postOrderToSheet();
  
  const url = "https://line.me/R/oaMessage/%40746wpose/?" + encodeURIComponent(orderText());
  copyOrder();
  window.open(url, "_blank");
}
```

- [ ] **Step 2: ปรับปรุง `copyOrder()`**

```javascript
function copyOrder() {
  if (!validateOrder()) return;
  const shopName = document.getElementById("shop").value.trim();
  saveShopName(shopName);
  
  navigator.clipboard.writeText(orderText())
    .then(() => toast("คัดลอกแล้ว วางส่งใน LINE ได้เลย ✓"))
    .catch(() => toast("คัดลอกไม่สำเร็จ ลองกดค้างเลือกข้อความแทน"));
}
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: integrate dual action (auto-save sheet + localstorage + line open)"
```

---

### Task 4: ตรวจสอบและทดสอบโค้ดทั้งหมด (Verification)

**Files:**
- Modify: `index.html`

- [ ] **Step 1: ตรวจสอบความถูกต้องของไวยากรณ์ JavaScript และ HTML tags ใน `index.html`**
- [ ] **Step 2: ทดสอบจำลองการส่งออเดอร์และการอ่าน LocalStorage ใน DOM environment**
- [ ] **Step 3: Commit และสรุปผลการพัฒนา**
