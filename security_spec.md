# Security Specification for Mahindra Accelo - Trolley Lifecycle & Maintenance Tracker

## 1. Data Invariants
- **Identity & Role Enforcement**: Users can only access authorized operational collections when authenticated with verified credentials. Users cannot self-escalate roles or spoof `uid` during profile creation or updates.
- **Work Order Integrity**: Maintenance technicians and operators can only update status, remarks, and progress photos on work orders; they cannot alter shop codes, asset IDs, or immutable creation metadata (`createdAt`, `requesterUid`).
- **Trolley Lifecycle Immutability**: Commissioning dates, historical work order logs (`work_order_logs`), and operational audit logs (`audit_logs`) are strictly append-only and cannot be modified or deleted.
- **Asset Lockout Safety Invariant**: An asset flagged as `quarantined_unsafe` or `unsafe_locked` cannot be cleared without a supervisor or safety clearance update.
- **Zero Commercial/Financial Exposure**: No billing rates, rate cards, or cost fields exist in any schema or document payload.
- **PII Isolation**: User profile emails and phone numbers in `/users/{userId}` are readable only by the profile owner or an administrator.

## 2. The "Dirty Dozen" Payloads (Attacks Prevented by Security Rules)
1. **Self-Promote to Super Admin**: A standard operator tries to create or update `/users/{uid}` setting `role: "super_admin"`.
2. **Ghost Financial Field Injection**: An attacker attempts to inject legacy commercial keys (`estimatedCost`, `actualCost`, `rateCardCode`) into `/work_orders/{id}`.
3. **Unverified Email Access**: A user with `email_verified: false` attempts to write to `/assets/{id}` or `/work_orders/{id}`.
4. **Cross-User Profile Scraping**: A standard operator attempts to read another user's private `/users/{otherUid}` document containing PII.
5. **Junk ID Poisoning**: An attacker creates an asset document with an oversized (>128 chars) or invalid-character document ID.
6. **Ghost Field Injection**: Adding unapproved arbitrary keys (`isAdmin: true`, `backdoor: 1`) to `/assets/{id}` or `/preventive_maintenance/{id}`.
7. **Deletion of Work Order Logs**: An actor executes `deleteDoc()` or `updateDoc()` on `/work_order_logs/{logId}` to erase repair history.
8. **Deletion of Immutable Audit Logs**: An actor executes `deleteDoc()` or `updateDoc()` on `/audit_logs/{auditId}` to hide lifecycle modifications.
9. **Spoofed Log Performer**: A user attempts to create a `/work_order_logs/{logId}` entry claiming `performedByUid` belongs to a different user.
10. **Excessive String Payload Attack**: Submitting an oversized (>1000 chars) malicious buffer into `jobDescription` or `remarks`.
11. **Array Exhaustion Attack**: Submitting more than 20 items in `assignedTechnicianUids` or `checklist` arrays.
12. **Unauthenticated Write**: An unauthenticated client attempting to query or modify trolley registry records.
