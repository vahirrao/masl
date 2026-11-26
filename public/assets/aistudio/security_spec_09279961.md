# Security Specification for FAB-CONTROL PRO

## 1. Data Invariants
- **Identity & Role Enforcement**: Users can only read authorized operational collections. Users cannot self-escalate roles or spoof `uid`.
- **Work Order Integrity**: Workers/technicians can only update status, remarks, and progress photos on work orders assigned to them; they cannot alter rates, shop associations, or estimated costs.
- **Shop Scope Scrutiny**: Shop supervisors can create and view work orders and assets for their assigned shops. Plant engineers can approve technical work orders.
- **Asset Lockout Safety Invariant**: An asset flagged as `quarantined_unsafe` or `unsafe_locked` cannot be marked active without a supervisor or safety officer clearance inspection.
- **Immutable Financial Rates**: Rate cards can only be modified by Super Admin and Technova Admin.
- **Audit Immutability**: Audit logs and historical logs are append-only and cannot be modified or deleted.

## 2. The "Dirty Dozen" Payloads (Attacks Prevented by Security Rules)
1. **Self-Promote to Super Admin**: A standard technician tries to update `/users/{uid}` setting `role: "super_admin"`.
2. **Work Order Cost Modification by Fabricator**: A worker alters `estimatedCost` or `actualCost` from 1,200 to 50,000.
3. **Cross-Shop Spoofing**: A Shop Supervisor from A1 raises an unauthorized work order for Press Shop.
4. **Bypassing PE Technical Approval**: A fabricator marks a job requiring PE sign-off directly to `Closed`.
5. **Junk ID Poisoning**: An attacker creates an asset document with a 15KB junk string ID or malicious Unicode.
6. **Ghost Field Injection**: Adding unapproved arbitrary keys (`isAdmin: true`, `backdoor: 1`) to `/work_orders/{id}`.
7. **Rate Card Manipulation**: An unauthorized user attempts to update the welding rate per meter in `/rate_cards/rc_01`.
8. **Deletion of Immutable Audit Logs**: An actor executes `deleteDoc()` on `/audit_logs/{auditId}` to hide unauthorized activity.
9. **Unsafe Asset Clearance Bypass**: Bypassing safety inspection by switching `safetyStatus: "safe"` on a quarantined trolley directly.
10. **Timestamp Tampering**: Injecting a fabricated backdated timestamp for SLA compliance instead of server time.
11. **Excessive String Payload Attack**: Submitting 10MB malicious buffer into work order `jobDescription`.
12. **Unauthenticated Write**: An unauthenticated HTTP/SDK client attempting to query or modify asset registry records.

## 3. Test Runner
Verified against Firestore security rules specification ensuring all 12 dirty payloads result in `PERMISSION_DENIED`.
