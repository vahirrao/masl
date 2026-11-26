import { writeBatch, doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from './firebase';
import {
  Shop,
  Asset,
  WorkOrder,
  WorkOrderLog,
  PreventiveMaintenance,
  ManpowerRecord,
  SafetyIncident,
  AuditLog,
  AppNotification,
} from '../types';

let seedCompletedThisSession = false;
let seedingInFlight: Promise<boolean> | null = null;

export async function seedAcceloDatabaseIfEmpty(
  currentUid: string,
  currentName: string
): Promise<boolean> {
  if (import.meta.env.VITE_DISABLE_DEMO_SEED === 'true' || seedCompletedThisSession) {
    return false;
  }

  if (seedingInFlight) {
    return seedingInFlight;
  }

  seedingInFlight = (async () => {
    try {
      // Check specifically for the canonical MASL TR-MASL-101 dataset sentinel
      const sentinelSnap = await getDoc(doc(db, 'assets', 'asset_tr_masl_101'));
      if (sentinelSnap.exists()) {
        seedCompletedThisSession = true;
        return false;
      }

      // Fetch existing doc IDs across collections to avoid collision/overwriting existing records
      const [
        existingShopDocs,
        existingAssetDocs,
        existingPmDocs,
        existingWoDocs,
        existingWoLogDocs,
        existingSafetyDocs,
        existingManpowerDocs,
        existingAuditDocs,
        existingNotifDocs,
      ] = await Promise.all([
        getDocs(collection(db, 'shops')),
        getDocs(collection(db, 'assets')),
        getDocs(collection(db, 'preventive_maintenance')),
        getDocs(collection(db, 'work_orders')),
        getDocs(collection(db, 'work_order_logs')),
        getDocs(collection(db, 'safety_incidents')),
        getDocs(collection(db, 'manpower')),
        getDocs(collection(db, 'audit_logs')),
        getDocs(
          query(
            collection(db, 'notifications'),
            where('recipientUid', 'in', [currentUid, 'all'])
          )
        ),
      ]);

      const existingIds = {
        shops: new Set(existingShopDocs.docs.map((d) => d.id)),
        assets: new Set(existingAssetDocs.docs.map((d) => d.id)),
        pm: new Set(existingPmDocs.docs.map((d) => d.id)),
        wo: new Set(existingWoDocs.docs.map((d) => d.id)),
        woLogs: new Set(existingWoLogDocs.docs.map((d) => d.id)),
        safety: new Set(existingSafetyDocs.docs.map((d) => d.id)),
        manpower: new Set(existingManpowerDocs.docs.map((d) => d.id)),
        audit: new Set(existingAuditDocs.docs.map((d) => d.id)),
        notif: new Set(existingNotifDocs.docs.map((d) => d.id)),
      };

      // If production already has real user-created assets (not our earlier demo seed), never inject dummy data
      if (!existingAssetDocs.empty && !existingIds.assets.has('asset_acc_001')) {
        seedCompletedThisSession = true;
        return false;
      }

  const batch = writeBatch(db);

  const shops: Shop[] = [
    {
      id: 'shop_press_a',
      name: 'Press Line A',
      code: 'PRESS-A',
      area: 'Bay A - Heavy Stamping & Feed',
      active: true,
      supervisorName: 'Rajesh Kulkarni',
      targetTAT: 2,
    },
    {
      id: 'shop_blank_b',
      name: 'Blanking Line B',
      code: 'BLANK-B',
      area: 'Bay B - Trapezoidal Blanking',
      active: true,
      supervisorName: 'Vikram Patil',
      targetTAT: 1,
    },
    {
      id: 'shop_sl1',
      name: 'Coil Slitting Line 1',
      code: 'SL-01',
      area: 'Bay C - North Slitting',
      active: true,
      supervisorName: 'Prakash Jadhav',
      targetTAT: 2,
    },
    {
      id: 'shop_ctl1',
      name: 'Cut-to-Length Line 1',
      code: 'CTL-01',
      area: 'Bay D - Sheet Leveling',
      active: true,
      supervisorName: 'Sandeep Deshmukh',
      targetTAT: 2,
    },
    {
      id: 'shop_dsp',
      name: 'Dispatch & Packaging Bay',
      code: 'DSP-01',
      area: 'South Loading Dock',
      active: true,
      supervisorName: 'Amol Shinde',
      targetTAT: 2,
    },
    {
      id: 'shop_trf',
      name: 'Trolley Maintenance & Fab Bay',
      code: 'TRF-01',
      area: 'Central Workshop',
      active: true,
      supervisorName: 'Nitin Pawar',
      targetTAT: 1,
    },
  ];

  shops.forEach((s) => {
    if (!existingIds.shops.has(s.id)) {
      batch.set(doc(db, 'shops', s.id), s);
    }
  });

  const assets: Asset[] = [
    {
      id: 'asset_tr_masl_101',
      qrCode: 'MASL-QR-101',
      trolleyNumber: 'TR-MASL-101',
      name: 'Heavy Coil Cradle Trolley #101',
      category: 'Coil Trolley',
      trolleyType: 'V-Block Coil Cradle',
      shopCode: 'PRESS-A',
      location: 'Press Line A — Feeder Track 1',
      partNumber: 'MASL-PRS-4500',
      dimensions: '2400 x 1400 x 850 mm',
      loadCapacityKg: 4500,
      condition: 'good',
      operationalStatus: 'active',
      safetyStatus: 'safe',
      commissioningDate: '2025-01-15',
      lastMaintenanceDate: '2026-04-10',
      nextMaintenanceDueDate: '2026-12-15',
      maintenanceQuarter: 'Q4',
      createdAt: '2025-01-15T08:30:00.000Z',
      updatedAt: '2026-09-02T15:45:00.000Z',
    },
    {
      id: 'asset_tr_masl_102',
      qrCode: 'MASL-QR-102',
      trolleyNumber: 'TR-MASL-102',
      name: 'Blank Stack Skid Trolley #102',
      category: 'Blanking Skid',
      trolleyType: 'Flatbed Roller Skid',
      shopCode: 'BLANK-B',
      location: 'Blanking Line B — Stacker Exit',
      partNumber: 'MASL-BLK-2400',
      dimensions: '2150 x 1280 x 740 mm',
      loadCapacityKg: 2400,
      condition: 'needs_repair',
      operationalStatus: 'under_maintenance',
      safetyStatus: 'pending_inspection',
      commissioningDate: '2025-03-20',
      lastMaintenanceDate: '2026-05-15',
      nextMaintenanceDueDate: '2026-11-25',
      maintenanceQuarter: 'Q4',
      createdAt: '2025-03-20T09:00:00.000Z',
      updatedAt: '2026-11-18T08:15:00.000Z',
    },
    {
      id: 'asset_tr_masl_103',
      qrCode: 'MASL-QR-103',
      trolleyNumber: 'TR-MASL-103',
      name: 'Stamped Blank Transfer Cart #103',
      category: 'Transfer Cart',
      trolleyType: 'Reinforced Frame Pallet',
      shopCode: 'PRESS-A',
      location: 'In Transit — Press Line A to CTL Bay',
      partNumber: 'MASL-PRS-3200',
      dimensions: '2500 x 1300 x 780 mm',
      loadCapacityKg: 3200,
      condition: 'excellent',
      operationalStatus: 'active',
      safetyStatus: 'safe',
      commissioningDate: '2025-04-12',
      lastMaintenanceDate: '2026-07-22',
      nextMaintenanceDueDate: '2026-12-22',
      maintenanceQuarter: 'Q4',
      createdAt: '2025-04-12T07:45:00.000Z',
      updatedAt: '2026-07-22T14:30:00.000Z',
    },
    {
      id: 'asset_tr_masl_104',
      qrCode: 'MASL-QR-104',
      trolleyNumber: 'TR-MASL-104',
      name: 'Slit Coil A-Frame Rack #104',
      category: 'Slit Coil Rack',
      trolleyType: 'Multi-Arm A-Frame',
      shopCode: 'BLANK-B',
      location: 'Quarantined — TRF-01 Welding Bay',
      partNumber: 'MASL-SLT-1800',
      dimensions: '1950 x 1100 x 1350 mm',
      loadCapacityKg: 1800,
      condition: 'quarantined_unsafe',
      operationalStatus: 'out_of_service',
      safetyStatus: 'unsafe_locked',
      commissioningDate: '2025-02-08',
      lastMaintenanceDate: '2026-05-22',
      nextMaintenanceDueDate: '2026-10-22',
      maintenanceQuarter: 'Q4',
      createdAt: '2025-02-08T10:15:00.000Z',
      updatedAt: '2026-11-16T15:20:00.000Z',
    },
    {
      id: 'asset_tr_masl_105',
      qrCode: 'MASL-QR-105',
      trolleyNumber: 'TR-MASL-105',
      name: 'Tow-Train Dispatch Bundle Cart #105',
      category: 'Dispatch Trolley',
      trolleyType: 'Tow-Train Coupled Cart',
      shopCode: 'DSP-01',
      location: 'In Transit — Blanking Line B to Dispatch Gate',
      partNumber: 'MASL-DSP-2600',
      dimensions: '2200 x 1200 x 700 mm',
      loadCapacityKg: 2600,
      condition: 'good',
      operationalStatus: 'active',
      safetyStatus: 'safe',
      commissioningDate: '2025-06-18',
      lastMaintenanceDate: '2026-08-28',
      nextMaintenanceDueDate: '2026-11-28',
      maintenanceQuarter: 'Q4',
      createdAt: '2025-06-18T08:00:00.000Z',
      updatedAt: '2026-08-28T13:15:00.000Z',
    },
    {
      id: 'asset_tr_masl_106',
      qrCode: 'MASL-QR-106',
      trolleyNumber: 'TR-MASL-106',
      name: 'CTL Sheet Pallet Carrier #106',
      category: 'Sheet Trolley',
      trolleyType: 'Heavy-Duty Sheet Carrier',
      shopCode: 'CTL-01',
      location: 'Cut-to-Length Line 1 — Brake Bay',
      partNumber: 'MASL-CTL-3500',
      dimensions: '2600 x 1350 x 760 mm',
      loadCapacityKg: 3500,
      condition: 'needs_repair',
      operationalStatus: 'under_maintenance',
      safetyStatus: 'pending_inspection',
      commissioningDate: '2025-07-25',
      lastMaintenanceDate: '2026-09-12',
      nextMaintenanceDueDate: '2026-12-12',
      maintenanceQuarter: 'Q4',
      createdAt: '2025-07-25T09:20:00.000Z',
      updatedAt: '2026-11-17T14:00:00.000Z',
    },
  ];

  assets.forEach((a) => {
    if (!existingIds.assets.has(a.id)) {
      batch.set(doc(db, 'assets', a.id), a);
    }
  });

  // Quarterly PM Records spanning Q1 - Q4 across MASL lines
  const pmRecords: PreventiveMaintenance[] = [
    {
      id: 'pm_tr_101_q2',
      assetId: 'asset_tr_masl_101',
      trolleyNumber: 'TR-MASL-101',
      shopCode: 'PRESS-A',
      quarter: 'Q2',
      year: 2026,
      scheduledDate: '2026-04-10',
      completedDate: '2026-04-10',
      assignedTeam: 'Team Alpha (Nitin Pawar)',
      status: 'Completed',
      checklist: [
        { item: 'Caster wheels & swivel bearings greased', checked: true },
        { item: 'Structural chassis & gusset welds inspected', checked: true },
        { item: 'Locking pins, latches & tow-hitch checked', checked: true },
        { item: 'Safety buffers, stops & reflectors intact', checked: true },
        { item: 'QR asset tag clean & scannable', checked: true },
      ],
      technicianRemarks: 'Q2 PM completed cleanly. All V-block saddle pads and caster bearings greased.',
      verifiedBySupervisor: 'Rajesh Kulkarni',
      conditionPostPM: 'excellent',
    },
    {
      id: 'pm_tr_102_q2',
      assetId: 'asset_tr_masl_102',
      trolleyNumber: 'TR-MASL-102',
      shopCode: 'BLANK-B',
      quarter: 'Q2',
      year: 2026,
      scheduledDate: '2026-05-15',
      completedDate: '2026-05-15',
      assignedTeam: 'Team Bravo (Mahesh More)',
      status: 'Completed',
      checklist: [
        { item: 'Caster wheels & swivel bearings greased', checked: true },
        { item: 'Structural chassis & gusset welds inspected', checked: true },
        { item: 'Locking pins, latches & tow-hitch checked', checked: true },
        { item: 'QR asset tag clean & scannable', checked: true },
      ],
      technicianRemarks: 'All roller skid rails aligned; minor bearing play flagged for Q4 check.',
      verifiedBySupervisor: 'Vikram Patil',
      conditionPostPM: 'good',
    },
    {
      id: 'pm_tr_103_q1',
      assetId: 'asset_tr_masl_103',
      trolleyNumber: 'TR-MASL-103',
      shopCode: 'PRESS-A',
      quarter: 'Q1',
      year: 2026,
      scheduledDate: '2026-02-18',
      completedDate: '2026-02-18',
      assignedTeam: 'Team Alpha (Nitin Pawar)',
      status: 'Completed',
      checklist: [
        { item: 'Caster wheels & swivel bearings greased', checked: true },
        { item: 'Frame flatness & corner gussets inspected', checked: true },
      ],
      technicianRemarks: 'Q1 structural & caster lubrication verified with zero defects.',
      verifiedBySupervisor: 'Rajesh Kulkarni',
      conditionPostPM: 'excellent',
    },
    {
      id: 'pm_tr_103_q3',
      assetId: 'asset_tr_masl_103',
      trolleyNumber: 'TR-MASL-103',
      shopCode: 'PRESS-A',
      quarter: 'Q3',
      year: 2026,
      scheduledDate: '2026-07-22',
      completedDate: '2026-07-22',
      assignedTeam: 'Team Alpha (Nitin Pawar)',
      status: 'Completed',
      checklist: [
        { item: 'Caster wheels & swivel bearings greased', checked: true },
        { item: 'Latch pin tolerance verified post-repair', checked: true },
        { item: 'QR asset tag clean & scannable', checked: true },
      ],
      technicianRemarks: 'Q3 PM completed; transit reflectors refreshed.',
      verifiedBySupervisor: 'Rajesh Kulkarni',
      conditionPostPM: 'excellent',
    },
    {
      id: 'pm_tr_104_q2',
      assetId: 'asset_tr_masl_104',
      trolleyNumber: 'TR-MASL-104',
      shopCode: 'BLANK-B',
      quarter: 'Q2',
      year: 2026,
      scheduledDate: '2026-05-22',
      completedDate: '2026-05-22',
      assignedTeam: 'Team Bravo (Mahesh More)',
      status: 'Completed',
      checklist: [
        { item: 'A-frame arm root weld NDT dye check', checked: true },
        { item: 'Caster wheel kingpins greased', checked: true },
      ],
      technicianRemarks: 'Passed Q2 inspection; arm dividers within 1 mm deflection limit.',
      verifiedBySupervisor: 'Vikram Patil',
      conditionPostPM: 'good',
    },
    {
      id: 'pm_tr_104_q4',
      assetId: 'asset_tr_masl_104',
      trolleyNumber: 'TR-MASL-104',
      shopCode: 'BLANK-B',
      quarter: 'Q4',
      year: 2026,
      scheduledDate: '2026-10-22',
      assignedTeam: 'Team Bravo (Mahesh More)',
      status: 'Overdue',
      checklist: [
        { item: 'A-frame arm root weld NDT dye check', checked: false },
        { item: 'Caster lock engagement check', checked: false },
      ],
      technicianRemarks: 'Pending structural fracture approval & safety lockout clearance.',
    },
    {
      id: 'pm_tr_105_q3',
      assetId: 'asset_tr_masl_105',
      trolleyNumber: 'TR-MASL-105',
      shopCode: 'DSP-01',
      quarter: 'Q3',
      year: 2026,
      scheduledDate: '2026-08-28',
      completedDate: '2026-08-28',
      assignedTeam: 'Team Alpha (Nitin Pawar)',
      status: 'Completed',
      checklist: [
        { item: 'Tow-hitch spring latch inspected', checked: true },
        { item: 'Wheel tread & kingpin greased', checked: true },
      ],
      technicianRemarks: 'Tow coupling spring tension verified for dispatch tugger train.',
      verifiedBySupervisor: 'Amol Shinde',
      conditionPostPM: 'good',
    },
    {
      id: 'pm_tr_105_q4',
      assetId: 'asset_tr_masl_105',
      trolleyNumber: 'TR-MASL-105',
      shopCode: 'DSP-01',
      quarter: 'Q4',
      year: 2026,
      scheduledDate: '2026-11-28',
      assignedTeam: 'Team Alpha (Nitin Pawar)',
      status: 'Scheduled',
      checklist: [
        { item: 'Caster wheels & swivel bearings greased', checked: false },
        { item: 'Tow-bar coupling pin check', checked: false },
        { item: 'QR asset tag clean & scannable', checked: false },
      ],
    },
    {
      id: 'pm_tr_106_q3',
      assetId: 'asset_tr_masl_106',
      trolleyNumber: 'TR-MASL-106',
      shopCode: 'CTL-01',
      quarter: 'Q3',
      year: 2026,
      scheduledDate: '2026-09-12',
      completedDate: '2026-09-12',
      assignedTeam: 'Team Bravo (Mahesh More)',
      status: 'Completed',
      checklist: [
        { item: 'Foot-brake pedal linkage lubricated', checked: true },
        { item: 'Sheet stoppers & corner bumpers verified', checked: true },
      ],
      technicianRemarks: 'Q3 PM completed cleanly at CTL Line 1.',
      verifiedBySupervisor: 'Sandeep Deshmukh',
      conditionPostPM: 'good',
    },
    {
      id: 'pm_tr_106_q4',
      assetId: 'asset_tr_masl_106',
      trolleyNumber: 'TR-MASL-106',
      shopCode: 'CTL-01',
      quarter: 'Q4',
      year: 2026,
      scheduledDate: '2026-11-18',
      assignedTeam: 'Team Bravo (Mahesh More)',
      status: 'In Progress',
      checklist: [
        { item: 'Foot-brake lock assembly inspection', checked: true },
        { item: 'Caster wheel alignment verification', checked: false },
      ],
      technicianRemarks: 'Brake pad wear observed during Q4 check; repair WO active.',
    },
  ];

  pmRecords.forEach((p) => {
    if (!existingIds.pm.has(p.id)) {
      batch.set(doc(db, 'preventive_maintenance', p.id), p);
    }
  });

  // Work Orders spanning Closed, Completed, In Progress, Awaiting PE Approval across TR-MASL-101 to 106
  const workOrders: WorkOrder[] = [
    {
      id: 'wo_tr_101_bd1',
      workOrderNumber: 'WO-MASL-2026-401',
      shopCode: 'PRESS-A',
      shopName: 'Press Line A',
      location: 'Press Line A — Feeder Track 1',
      requesterUid: currentUid,
      requesterName: 'Rajesh Kulkarni',
      assetId: 'asset_tr_masl_101',
      trolleyNumber: 'TR-MASL-101',
      trolleyType: 'V-Block Coil Cradle',
      partNumber: 'MASL-PRS-4500',
      isBreakdown: true,
      failureType: 'MIG Welding Crack',
      jobDescription:
        'Primary breakdown: MIG welding crack detected along left V-block base gusset seam under heavy coil transfer.',
      activityType: 'Welding',
      quantity: 2,
      unit: 'Seams',
      priority: 'High',
      status: 'Closed',
      requiredDate: '2026-06-14',
      scheduledDate: '2026-06-12',
      startedAt: '2026-06-12T10:30:00.000Z',
      completedAt: '2026-06-14T16:30:00.000Z',
      turnaroundDays: 2.3,
      assignedTechnicianUids: ['tech_02'],
      assignedTechnicianNames: ['Suresh Kamble'],
      peApproved: true,
      peApprovalNotes: 'Reinforced MIG root pass + 8mm backing plate welded and dye-tested.',
      qualityInspectionPassed: true,
      createdAt: '2026-06-12T09:15:00.000Z',
      updatedAt: '2026-06-14T16:45:00.000Z',
    },
    {
      id: 'wo_tr_101_bd2',
      workOrderNumber: 'WO-MASL-2026-402',
      shopCode: 'PRESS-A',
      shopName: 'Press Line A',
      location: 'Press Line A — Feeder Track 1',
      requesterUid: currentUid,
      requesterName: 'Rajesh Kulkarni',
      assetId: 'asset_tr_masl_101',
      trolleyNumber: 'TR-MASL-101',
      trolleyType: 'V-Block Coil Cradle',
      partNumber: 'MASL-PRS-4500',
      isBreakdown: true,
      failureType: 'Side Stop Bracket Fatigue',
      jobDescription:
        'Secondary breakdown: Coil side stop bracket pin sheared during press destacking transfer.',
      activityType: 'Repair',
      quantity: 1,
      unit: 'Bracket',
      priority: 'Normal',
      status: 'Completed',
      requiredDate: '2026-09-02',
      scheduledDate: '2026-09-01',
      startedAt: '2026-09-01T11:00:00.000Z',
      completedAt: '2026-09-02T15:20:00.000Z',
      turnaroundDays: 1.2,
      assignedTechnicianUids: ['tech_01'],
      assignedTechnicianNames: ['Rameshwar Bhosale'],
      peApproved: true,
      peApprovalNotes: 'Replaced high-tensile stop pin and safety retainer clip.',
      qualityInspectionPassed: true,
      createdAt: '2026-09-01T08:45:00.000Z',
      updatedAt: '2026-09-02T15:45:00.000Z',
    },
    {
      id: 'wo_tr_102_bd1',
      workOrderNumber: 'WO-MASL-2026-403',
      shopCode: 'BLANK-B',
      shopName: 'Blanking Line B',
      location: 'Blanking Line B — Stacker Exit',
      requesterUid: currentUid,
      requesterName: 'Vikram Patil',
      assetId: 'asset_tr_masl_102',
      trolleyNumber: 'TR-MASL-102',
      trolleyType: 'Flatbed Roller Skid',
      partNumber: 'MASL-BLK-2400',
      isBreakdown: true,
      failureType: 'Wheel Bearing Failure',
      jobDescription:
        'Breakdown reported today: Rear swivel caster wheel bearing seized under stacked blank load, locking trolley rotation.',
      activityType: 'Repair',
      quantity: 2,
      unit: 'Bearings',
      priority: 'Critical',
      status: 'In Progress',
      requiredDate: '2026-11-19',
      scheduledDate: '2026-11-18',
      startedAt: '2026-11-18T08:15:00.000Z',
      assignedTechnicianUids: ['tech_01'],
      assignedTechnicianNames: ['Rameshwar Bhosale'],
      peApproved: true,
      createdAt: '2026-11-18T07:30:00.000Z',
      updatedAt: '2026-11-18T08:15:00.000Z',
    },
    {
      id: 'wo_tr_104_bd1',
      workOrderNumber: 'WO-MASL-2026-404',
      shopCode: 'BLANK-B',
      shopName: 'Blanking Line B',
      location: 'Quarantined — TRF-01 Welding Bay',
      requesterUid: currentUid,
      requesterName: 'Vikram Patil',
      assetId: 'asset_tr_masl_104',
      trolleyNumber: 'TR-MASL-104',
      trolleyType: 'Multi-Arm A-Frame',
      partNumber: 'MASL-SLT-1800',
      isBreakdown: true,
      failureType: 'A-Frame Mast Structural Fracture',
      jobDescription:
        'A-frame divider arm root bent 6 degrees after overhead crane hook snag; red safety lockout applied pending PE fabrication drawing.',
      activityType: 'Fabrication',
      quantity: 1,
      unit: 'Frame',
      priority: 'Critical',
      status: 'Awaiting PE Approval',
      requiredDate: '2026-11-21',
      assignedTechnicianUids: ['tech_02'],
      assignedTechnicianNames: ['Suresh Kamble'],
      peApproved: false,
      createdAt: '2026-11-16T15:20:00.000Z',
      updatedAt: '2026-11-16T15:30:00.000Z',
    },
    {
      id: 'wo_tr_103_m1',
      workOrderNumber: 'WO-MASL-2026-405',
      shopCode: 'PRESS-A',
      shopName: 'Press Line A',
      location: 'Press Line A — Transfer Corridor',
      requesterUid: currentUid,
      requesterName: 'Rajesh Kulkarni',
      assetId: 'asset_tr_masl_103',
      trolleyNumber: 'TR-MASL-103',
      trolleyType: 'Reinforced Frame Pallet',
      partNumber: 'MASL-PRS-3200',
      isBreakdown: false,
      failureType: 'Locking Pin / Latch Jam',
      jobDescription:
        'Scheduled latch spring overhaul and caster wheel alignment calibration before high-volume transit duty.',
      activityType: 'Locking',
      quantity: 2,
      unit: 'Latches',
      priority: 'Normal',
      status: 'Closed',
      requiredDate: '2026-07-19',
      scheduledDate: '2026-07-18',
      startedAt: '2026-07-18T10:00:00.000Z',
      completedAt: '2026-07-19T11:30:00.000Z',
      turnaroundDays: 1.0,
      assignedTechnicianUids: ['tech_03'],
      assignedTechnicianNames: ['Mahesh More'],
      peApproved: true,
      qualityInspectionPassed: true,
      createdAt: '2026-07-18T09:00:00.000Z',
      updatedAt: '2026-07-19T12:00:00.000Z',
    },
    {
      id: 'wo_tr_106_bd1',
      workOrderNumber: 'WO-MASL-2026-406',
      shopCode: 'CTL-01',
      shopName: 'Cut-to-Length Line 1',
      location: 'Cut-to-Length Line 1 — Brake Bay',
      requesterUid: currentUid,
      requesterName: 'Sandeep Deshmukh',
      assetId: 'asset_tr_masl_106',
      trolleyNumber: 'TR-MASL-106',
      trolleyType: 'Heavy-Duty Sheet Carrier',
      partNumber: 'MASL-CTL-3500',
      isBreakdown: true,
      failureType: 'Foot-Brake Lock Slippage',
      jobDescription:
        'Trolley wheel brake pedal slipping on sloped CTL outfeed ramp; replacing brake cam & friction pad.',
      activityType: 'Repair',
      quantity: 2,
      unit: 'Brakes',
      priority: 'High',
      status: 'In Progress',
      requiredDate: '2026-11-19',
      scheduledDate: '2026-11-17',
      startedAt: '2026-11-17T14:00:00.000Z',
      assignedTechnicianUids: ['tech_03'],
      assignedTechnicianNames: ['Mahesh More'],
      peApproved: true,
      createdAt: '2026-11-17T11:30:00.000Z',
      updatedAt: '2026-11-17T14:00:00.000Z',
    },
  ];

  workOrders.forEach((w) => {
    if (!existingIds.wo.has(w.id)) {
      batch.set(doc(db, 'work_orders', w.id), w);
    }
  });

  const workOrderLogs: WorkOrderLog[] = [
    {
      id: 'wolog_tr_101_1',
      workOrderId: 'wo_tr_101_bd1',
      assetId: 'asset_tr_masl_101',
      trolleyNumber: 'TR-MASL-101',
      action: 'Breakdown Reported (MIG Weld Crack)',
      statusFrom: 'Draft',
      statusTo: 'Submitted',
      remarks: 'MIG welding crack spotted on left V-block gusset seam during Press Line A coil change.',
      performedByUid: currentUid,
      performedByName: 'Rajesh Kulkarni',
      performedByRole: 'shop_supervisor',
      timestamp: '2026-06-12T09:15:00.000Z',
    },
    {
      id: 'wolog_tr_101_2',
      workOrderId: 'wo_tr_101_bd1',
      assetId: 'asset_tr_masl_101',
      trolleyNumber: 'TR-MASL-101',
      action: 'MIG Welding Repair & NDT Cleared',
      statusFrom: 'In Progress',
      statusTo: 'Closed',
      remarks: 'Gouged cracked seam, re-welded with ER70S-6 MIG wire + 8mm gusset plate, dye-penetrant passed.',
      performedByUid: currentUid,
      performedByName: 'Suresh Kamble',
      performedByRole: 'technician',
      timestamp: '2026-06-14T16:30:00.000Z',
    },
    {
      id: 'wolog_tr_101_3',
      workOrderId: 'wo_tr_101_bd2',
      assetId: 'asset_tr_masl_101',
      trolleyNumber: 'TR-MASL-101',
      action: 'Secondary Breakdown Logged',
      statusFrom: 'Draft',
      statusTo: 'In Progress',
      remarks: 'Coil side stop pin sheared; trolley isolated to TRF-01 bay for pin & sleeve swap.',
      performedByUid: currentUid,
      performedByName: 'Rajesh Kulkarni',
      performedByRole: 'shop_supervisor',
      timestamp: '2026-09-01T08:45:00.000Z',
    },
    {
      id: 'wolog_tr_101_4',
      workOrderId: 'wo_tr_101_bd2',
      assetId: 'asset_tr_masl_101',
      trolleyNumber: 'TR-MASL-101',
      action: 'Secondary Repair Completed',
      statusFrom: 'In Progress',
      statusTo: 'Completed',
      remarks: 'Fitted hardened EN24 stop pin & locking circlip; returned to Press Line A active service.',
      performedByUid: currentUid,
      performedByName: 'Rameshwar Bhosale',
      performedByRole: 'technician',
      timestamp: '2026-09-02T15:20:00.000Z',
    },
    {
      id: 'wolog_tr_102_1',
      workOrderId: 'wo_tr_102_bd1',
      assetId: 'asset_tr_masl_102',
      trolleyNumber: 'TR-MASL-102',
      action: 'Wheel Bearing Breakdown Reported',
      statusFrom: 'Draft',
      statusTo: 'In Progress',
      remarks: 'Rear swivel caster bearing seized on Blanking Line B. Dismantling hub for bearing extraction.',
      performedByUid: currentUid,
      performedByName: 'Rameshwar Bhosale',
      performedByRole: 'technician',
      timestamp: '2026-11-18T08:15:00.000Z',
    },
    {
      id: 'wolog_tr_103_1',
      workOrderId: 'wo_tr_103_m1',
      assetId: 'asset_tr_masl_103',
      trolleyNumber: 'TR-MASL-103',
      action: 'Latch Overhaul Verified',
      statusFrom: 'In Progress',
      statusTo: 'Closed',
      remarks: 'Replaced latch springs and calibrated wheel alignment; cleared for active transit.',
      performedByUid: currentUid,
      performedByName: 'Mahesh More',
      performedByRole: 'technician',
      timestamp: '2026-07-19T11:30:00.000Z',
    },
    {
      id: 'wolog_tr_104_1',
      workOrderId: 'wo_tr_104_bd1',
      assetId: 'asset_tr_masl_104',
      trolleyNumber: 'TR-MASL-104',
      action: 'Quarantined — Awaiting PE Approval',
      statusFrom: 'Submitted',
      statusTo: 'Awaiting PE Approval',
      remarks: 'Red lockout tag locked onto A-frame mast; awaiting Plant Engineer weld procedure approval.',
      performedByUid: currentUid,
      performedByName: 'Suresh Kamble',
      performedByRole: 'technician',
      timestamp: '2026-11-16T15:30:00.000Z',
    },
    {
      id: 'wolog_tr_106_1',
      workOrderId: 'wo_tr_106_bd1',
      assetId: 'asset_tr_masl_106',
      trolleyNumber: 'TR-MASL-106',
      action: 'Brake Assembly Repair Started',
      statusFrom: 'Assigned',
      statusTo: 'In Progress',
      remarks: 'Removed worn brake cam; installing heavy-duty locking pedal assembly.',
      performedByUid: currentUid,
      performedByName: 'Mahesh More',
      performedByRole: 'technician',
      timestamp: '2026-11-17T14:00:00.000Z',
    },
  ];

  workOrderLogs.forEach((l) => {
    if (!existingIds.woLogs.has(l.id)) {
      batch.set(doc(db, 'work_order_logs', l.id), l);
    }
  });

  // 2 active Safety Lockouts / Defect Observations + 1 cleared record for TR-MASL-101 history
  const safetyIncidents: SafetyIncident[] = [
    {
      id: 'inc_tr_001',
      incidentNumber: 'SAF-MASL-2026-104',
      shopCode: 'BLANK-B',
      location: 'Quarantined — TRF-01 Welding Bay',
      severity: 'Critical Unsafe',
      description:
        'TR-MASL-104 A-frame divider mast bent 6 degrees with root crack after crane hook snag. Red lockout tag applied.',
      affectedAssetId: 'asset_tr_masl_104',
      trolleyNumber: 'TR-MASL-104',
      actionTaken: 'Asset quarantined out of service; awaiting PE structural fabrication approval.',
      status: 'Open',
      reportedBy: 'Vikram Patil',
      reportedAt: '2026-11-16T15:20:00.000Z',
    },
    {
      id: 'inc_tr_002',
      incidentNumber: 'SAF-MASL-2026-106',
      shopCode: 'CTL-01',
      location: 'Cut-to-Length Line 1 — Outfeed Ramp',
      severity: 'High',
      description:
        'TR-MASL-106 foot-brake lock slipped under 2.8T sheet bundle load on sloped outfeed ramp.',
      affectedAssetId: 'asset_tr_masl_106',
      trolleyNumber: 'TR-MASL-106',
      actionTaken: 'Wheel chocks applied; trolley shifted to brake bay for cam & pad replacement.',
      status: 'Investigating',
      reportedBy: 'Sandeep Deshmukh',
      reportedAt: '2026-11-17T11:35:00.000Z',
    },
    {
      id: 'inc_tr_003',
      incidentNumber: 'SAF-MASL-2026-061',
      shopCode: 'PRESS-A',
      location: 'Press Line A — Feeder Track 1',
      severity: 'Medium',
      description: 'TR-MASL-101 MIG weld hairline crack identified during pre-shift safety walk.',
      affectedAssetId: 'asset_tr_masl_101',
      trolleyNumber: 'TR-MASL-101',
      actionTaken: 'Reinforcement gusset welded, dye-penetrant tested, and cleared for service.',
      status: 'Resolved & Cleared',
      reportedBy: 'Rajesh Kulkarni',
      reportedAt: '2026-06-12T09:10:00.000Z',
      clearedAt: '2026-06-14T16:45:00.000Z',
    },
  ];

  safetyIncidents.forEach((s) => {
    if (!existingIds.safety.has(s.id)) {
      batch.set(doc(db, 'safety_incidents', s.id), s);
    }
  });

  const manpower: ManpowerRecord[] = [
    {
      id: 'mp_01',
      employeeCode: 'MASL-MNT-101',
      name: 'Rameshwar Bhosale',
      designation: 'Senior Mechanical Technician',
      primarySkill: 'Caster & Hydraulic Systems',
      certifications: ['LOTO Certified', 'Forklift Rigging'],
      assignedShop: 'BLANK-B',
      currentShift: 'Shift A (Morning)',
      attendanceStatus: 'Present',
      activeWorkOrders: 1,
      safetyInducted: true,
    },
    {
      id: 'mp_02',
      employeeCode: 'MASL-MNT-104',
      name: 'Suresh Kamble',
      designation: 'Certified Structural Welder',
      primarySkill: 'MIG / Arc Structural Welding',
      certifications: ['AWS D1.1', 'Hot Work Permit'],
      assignedShop: 'PRESS-A',
      currentShift: 'Shift A (Morning)',
      attendanceStatus: 'Present',
      activeWorkOrders: 1,
      safetyInducted: true,
    },
    {
      id: 'mp_03',
      employeeCode: 'MASL-MNT-109',
      name: 'Mahesh More',
      designation: 'PM Inspection Technician',
      primarySkill: 'Quarterly PM & NDT Check',
      certifications: ['Dye Penetrant L2', 'LOTO Certified'],
      assignedShop: 'CTL-01',
      currentShift: 'Shift B (Evening)',
      attendanceStatus: 'Present',
      activeWorkOrders: 1,
      safetyInducted: true,
    },
  ];

  manpower.forEach((m) => {
    if (!existingIds.manpower.has(m.id)) {
      batch.set(doc(db, 'manpower', m.id), m);
    }
  });

  const auditLogs: AuditLog[] = [
    {
      id: 'aud_tr_101_1',
      entityType: 'Asset',
      entityId: 'asset_tr_masl_101',
      action: 'Commissioned Trolley',
      performedByUid: currentUid,
      performedByName: currentName || 'System Seed',
      performedByRole: 'super_admin',
      details: 'TR-MASL-101 commissioned at Press Line A (PRESS-A) with 4500 kg rated capacity.',
      timestamp: '2025-01-15T08:30:00.000Z',
    },
    {
      id: 'aud_tr_102_1',
      entityType: 'Asset',
      entityId: 'asset_tr_masl_102',
      action: 'Commissioned Trolley',
      performedByUid: currentUid,
      performedByName: currentName || 'System Seed',
      performedByRole: 'super_admin',
      details: 'TR-MASL-102 commissioned at Blanking Line B (BLANK-B) with 2400 kg rated capacity.',
      timestamp: '2025-03-20T09:00:00.000Z',
    },
    {
      id: 'aud_tr_104_1',
      entityType: 'Asset',
      entityId: 'asset_tr_masl_104',
      action: 'Safety Lockout Applied',
      performedByUid: currentUid,
      performedByName: 'Vikram Patil',
      performedByRole: 'shop_supervisor',
      details: 'TR-MASL-104 quarantined out of service due to A-frame mast fracture.',
      timestamp: '2026-11-16T15:20:00.000Z',
    },
    {
      id: 'aud_tr_105_1',
      entityType: 'Asset',
      entityId: 'asset_tr_masl_105',
      action: 'Transit Dispatch Check',
      performedByUid: currentUid,
      performedByName: 'Amol Shinde',
      performedByRole: 'shop_supervisor',
      details: 'TR-MASL-105 cleared for tow-train transit between Blanking Line B and Dispatch Gate.',
      timestamp: '2026-11-10T10:00:00.000Z',
    },
  ];

  auditLogs.forEach((a) => {
    if (!existingIds.audit.has(a.id)) {
      batch.set(doc(db, 'audit_logs', a.id), a);
    }
  });

  const notifications: AppNotification[] = [
    {
      id: 'notif_tr_001',
      recipientUid: 'all',
      title: 'Safety Lockout: TR-MASL-104',
      message: 'Slit Coil A-Frame Rack #104 quarantined at Blanking Line B awaiting PE approval.',
      type: 'safety_lockout',
      link: 'safety',
      read: false,
      createdAt: '2026-11-16T15:30:00.000Z',
    },
    {
      id: 'notif_tr_002',
      recipientUid: 'all',
      title: 'Breakdown Alert: TR-MASL-102',
      message: 'Wheel bearing failure reported today on Blanking Line B (WO-MASL-2026-403).',
      type: 'work_order',
      link: 'trolley-history',
      read: false,
      createdAt: '2026-11-18T07:35:00.000Z',
    },
    {
      id: 'notif_tr_003',
      recipientUid: 'all',
      title: 'Safety Defect: TR-MASL-106',
      message: 'Foot-brake lock slippage logged at CTL-01; brake assembly repair active.',
      type: 'safety_lockout',
      link: 'safety',
      read: false,
      createdAt: '2026-11-17T11:40:00.000Z',
    },
  ];

  notifications.forEach((n) => {
    if (!existingIds.notif.has(n.id)) {
      batch.set(doc(db, 'notifications', n.id), n);
    }
  });

      await batch.commit();
      seedCompletedThisSession = true;
      return true;
    } finally {
      seedingInFlight = null;
    }
  })();

  return seedingInFlight;
}
