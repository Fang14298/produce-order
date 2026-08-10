# ระบบบันทึกออเดอร์ลง Google Sheet อัตโนมัติ & แจ้งเตือน LINE เปลี่ยนสถานะ Implementation Plan

> **Status:** ✅ Completed & Verified  
> **Last Updated:** 10 สิงหาคม 2026

**Goal:** เพิ่มระบบจำชื่อร้านค้า ที่อยู่จัดส่ง (บังคับ) และเลขประจำตัวผู้เสียภาษี (ไม่บังคับ) ลงใน LocalStorage, เพิ่มระบบดึงราคาสดจาก Google Sheet GViz API 100%, ปรับแต่ง Mobile UX สำหรับ 200+ รายการสินค้า, บันทึกออเดอร์ลง Google Sheet อัตโนมัติ (ผ่าน Webhook), และระบบยิง LINE Push Messages แจ้งอัปเดตสถานะให้อัตโนมัติเมื่อแอดมินเปลี่ยนสถานะใน Google Sheet (`onEditStatus`)

**Architecture:** 
- ใน `index.html` อ่าน/บันทึกค่าชื่อร้าน ที่อยู่ และเลขผู้เสียภาษีผ่าน `localStorage`
- เพิ่ม Mobile UX features: ปุ่มล้างคำค้นหา `✕`, เมนูดร็อปดาวน์เลือกหมวดหมู่, หัวข้อหมวดหมู่พับเปิด-ปิดได้ (Accordions), ปุ่มชิปกรองดูเฉพาะ `"🛒 เลือกแล้ว"`
- ฟังก์ชั่น `postOrderToSheet(orderPayload)` ส่งข้อมูลออเดอร์รวมถึง `address` และ `taxId` เข้า Google Apps Script Webhook
- Google Apps Script ใช้งาน `LockService` จัดการ Concurrency และบันทึกลง Google Sheet ตาราง 11 คอลัมน์ (A-K)
- เพิ่มทริกเกอร์ `onEditStatus(e)` ใน Google Apps Script: เมื่อแอดมินเปลี่ยนค่าในคอลัมน์ J (`สถานะ`) สคริปต์จะยิง LINE Messaging API Push Message แจ้งลูกค้าอัตโนมัติ Real-time

**Tech Stack:** HTML5, Vanilla JavaScript (ES6+), LINE LIFF SDK, LocalStorage API, Fetch API (GViz + Webhook), Google Apps Script (Messaging API & OnEdit Triggers)

## Global Constraints

- **Color Scheme**: `light only` (คงเดิม)
- **Cutoff Time**: `20:00 น.` (คงเดิม)
- **Minimum Delivery Date**: `วันพรุ่งนี้` (คงเดิม + iOS Auto Fix Event Listener)
- **Validation**:
  - ชื่อร้านค้า (`*`) — บังคับกรอก
  - ที่อยู่จัดส่ง (`*`) — บังคับกรอก
  - เลขประจำตัวผู้เสียภาษี — ไม่บังคับกรอก
- **LINE OA URL / LIFF**: Integrated via LINE LIFF ID `2011037440-PBPwdRGn`

---

### Task 1: เพิ่มระบบจำชื่อร้านค้า ที่อยู่จัดส่ง และเลขผู้เสียภาษีด้วย LocalStorage
- [x] **Step 1: เพิ่มฟังก์ชั่น `loadSavedFields()` และ `saveSavedFields()`**
- [x] **Step 2: เรียกใช้ `loadSavedFields()` ในช่วง `init` และผูก event listener `input` บนช่อง `#shop`, `#address`, `#taxId`**
- [x] **Step 3: ตรวจสอบการทำงานของ LocalStorage**

---

### Task 2: ปรับแต่ง Mobile UX สำหรับรายการสินค้าจำนวนมาก (200+ Items)
- [x] **Step 1: เพิ่มช่องค้นหาพร้อมปุ่ม `✕` เคลียร์ข้อความและแสดงจำนวนผลลัพธ์ที่พบ**
- [x] **Step 2: เพิ่มเมนูดร็อปดาวน์เลือกหมวดหมู่ทางด่วน**
- [x] **Step 3: ปรับแต่งหัวข้อหมวดหมู่ให้พับเปิด-ปิดได้ (Collapsible Category Accordions)**
- [x] **Step 4: เพิ่มปุ่มชิปทางด่วนกรองเฉพาะ `"🛒 เลือกแล้ว"`**

---

### Task 3: ระบบแจ้งเตือน LINE อัตโนมัติเมื่อแอดมินเปลี่ยนสถานะ (`onEditStatus`)
- [x] **Step 1: เพิ่มฟังก์ชั่น `onEditStatus(e)` ใน `examples/google-apps-script.gs`**
- [x] **Step 2: รองรับข้อความตามสถานะ (`ยืนยันแล้ว`, `กำลังจัดส่ง`, `จัดส่งเรียบร้อย`, `ยกเลิก`)**
- [x] **Step 3: เพิ่มฟังก์ชั่นทดสอบ `testOnEditStatus()` สำหรับกดรันใน Apps Script IDE**
- [x] **Step 4: เขียนคู่มือการตั้งค่าทริกเกอร์แบบจับเวลา/เหตุการณ์ใน `README.md`**

---

### Task 4: ตรวจสอบและรับรองความถูกต้อง (Verification)
- [x] **Step 1: ตรวจสอบความถูกต้องของไวยากรณ์ JavaScript ใน `index.html`** (ผ่านการตรวจสอบ 100%)
- [x] **Step 2: ทดสอบจำลองการส่งออเดอร์และการรันฟังก์ชั่นใน Apps Script IDE**
- [x] **Step 3: อัปเดตเอกสารทั้งหมด (`README.md`, `specs/`, `plans/`) ให้สอดคล้องกัน**
