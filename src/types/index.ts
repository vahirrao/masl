export type Language = 'en' | 'mr';

export type UserRole =
  | 'super_admin'
  | 'plant_manager'
  | 'maintenance_head'
  | 'shop_supervisor'
  | 'plant_engineer'
  | 'technician'
  | 'operator';

export type NavPage =
  | 'dashboard'
  | 'trolley-history'
  | 'work-orders'
  | 'assets'
  | 'pm'
  | 'manpower'
  | 'safety'
  | 'shops'
  | 'reports';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  assignedShops?: string[];
  department?: string;
  phone?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface Shop {
  id: string;
  name: string;
  code: string;
  area?: string;
  active: boolean;
  supervisorName?: string;
  targetTAT?: number;
}

export type AssetCondition =
  | 'excellent'
  | 'good'
  | 'needs_repair'
  | 'critical_damage'
  | 'quarantined_unsafe';

export type OperationalStatus =
  | 'active'
  | 'under_maintenance'
  | 'out_of_service'
  | 'scrapped';

export type SafetyStatus = 'safe' | 'pending_inspection' | 'unsafe_locked';

export interface Asset {
  id: string;
  qrCode: string;
  trolleyNumber: string;
  name: string;
  category?: string;
  trolleyType?: string;
  shopCode: string;
  location?: string;
  partNumber?: string;
  dimensions?: string;
  loadCapacityKg?: number;
  condition: AssetCondition;
  operationalStatus: OperationalStatus;
  safetyStatus: SafetyStatus;
  commissioningDate?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDueDate?: string;
  maintenanceQuarter?: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  createdAt: string;
  updatedAt: string;
}

export type WorkOrderActivityType =
  | 'Fabrication'
  | 'Welding'
  | 'Painting'
  | 'Cleaning'
  | 'Locking'
  | 'Resting'
  | 'Repair'
  | 'Modification'
  | 'General Maintenance';

export type WorkOrderPriority = 'Normal' | 'High' | 'Urgent' | 'Critical';

export type WorkOrderStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under Review'
  | 'Awaiting PE Approval'
  | 'Approved'
  | 'Rejected'
  | 'Assigned'
  | 'Scheduled'
  | 'In Progress'
  | 'On Hold'
  | 'Awaiting Material'
  | 'Awaiting Inspection'
  | 'Rework Required'
  | 'Completed'
  | 'Closed'
  | 'Cancelled';

export interface WorkOrder {
  id: string;
  workOrderNumber: string;
  shopCode: string;
  shopName?: string;
  location?: string;
  requesterUid: string;
  requesterName?: string;
  assetId?: string;
  trolleyNumber?: string;
  trolleyType?: string;
  partNumber?: string;
  failureType?: string;
  isBreakdown?: boolean;
  jobDescription: string;
  activityType: WorkOrderActivityType;
  quantity?: number;
  unit?: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  requiredDate?: string;
  scheduledDate?: string;
  startedAt?: string;
  completedAt?: string;
  turnaroundDays?: number;
  assignedTechnicianUids?: string[];
  assignedTechnicianNames?: string[];
  peApproved?: boolean;
  peApprovalNotes?: string;
  qualityInspectionPassed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOrderLog {
  id: string;
  workOrderId: string;
  assetId?: string;
  trolleyNumber?: string;
  action: string;
  statusFrom?: string;
  statusTo?: string;
  remarks?: string;
  performedByUid: string;
  performedByName?: string;
  performedByRole?: string;
  timestamp: string;
}

export interface PMChecklistItem {
  item: string;
  checked: boolean;
  notes?: string;
}

export interface PreventiveMaintenance {
  id: string;
  assetId: string;
  trolleyNumber: string;
  shopCode: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  year: number;
  scheduledDate?: string;
  completedDate?: string;
  assignedTeam?: string;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Overdue';
  checklist?: PMChecklistItem[];
  technicianRemarks?: string;
  verifiedBySupervisor?: string;
  conditionPostPM?: 'excellent' | 'good' | 'rework_needed';
}

export interface ManpowerRecord {
  id: string;
  employeeCode: string;
  name: string;
  designation: string;
  primarySkill?: string;
  certifications?: string[];
  assignedShop?: string;
  currentShift?: 'Shift A (Morning)' | 'Shift B (Evening)' | 'Shift C (Night)' | 'General';
  attendanceStatus: 'Present' | 'On Leave' | 'Overtime' | 'Absent';
  activeWorkOrders?: number;
  safetyInducted?: boolean;
}

export interface SafetyIncident {
  id: string;
  incidentNumber: string;
  shopCode: string;
  location?: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical Unsafe';
  description: string;
  affectedAssetId?: string;
  trolleyNumber?: string;
  actionTaken?: string;
  status: 'Open' | 'Investigating' | 'Corrective Action' | 'Resolved & Cleared';
  reportedBy?: string;
  reportedAt?: string;
  clearedAt?: string;
}

export interface AppNotification {
  id: string;
  recipientUid: string;
  title: string;
  message: string;
  type: 'work_order' | 'sla_breach' | 'pe_approval' | 'pm_due' | 'safety_lockout';
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  performedByUid: string;
  performedByName?: string;
  performedByRole?: string;
  details?: string;
  timestamp: string;
}
