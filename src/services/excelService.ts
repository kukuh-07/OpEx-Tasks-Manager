import { readSheet, type CellValue, type SheetData } from 'read-excel-file/browser';
import writeXlsxFile from 'write-excel-file/browser';
import {
  AREAS,
  BRANCHES,
  DEPARTMENTS,
  getTaskAgeDays,
  getTaskSlaInfo,
  OUTLETS,
  SLA_HOURS_BY_PRIORITY,
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type CreateTaskInput,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type UserProfile,
} from '../types';

export interface ParsedImportRow {
  rowNumber: number;
  valid: boolean;
  error?: string;
  assigneeLabel: string;
  payload: CreateTaskInput;
}

function safeCellText(val: unknown): string {
  const s = String(val ?? '');
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

function normalizeHeader(cell: CellValue | null): string {
  return String(cell ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function parseCellString(cell: CellValue | null): string {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    return cell.toISOString().slice(0, 10);
  }
  return String(cell).trim();
}

function parseDueDate(cell: CellValue | null): string | null {
  if (cell === null || cell === undefined || cell === '') return null;
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    return cell.toISOString().slice(0, 10);
  }
  const s = String(cell).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }
  return null;
}

function parseCsvText(text: string): SheetData {
  const rows: SheetData = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function matchPriority(raw: string): TaskPriority {
  const found = TASK_PRIORITIES.find((p) => p.toLowerCase() === raw.toLowerCase());
  return found ?? 'Medium';
}

function matchStatus(raw: string): TaskStatus {
  const found = TASK_STATUSES.find((s) => s.toLowerCase() === raw.toLowerCase());
  return found ?? 'Open';
}

export async function parseExcelOrCsvTasks(
  file: File,
  users: UserProfile[],
  currentUser: UserProfile | null
): Promise<ParsedImportRow[]> {
  const nameLower = file.name.toLowerCase();
  let matrix: SheetData;

  if (nameLower.endsWith('.csv')) {
    const text = await file.text();
    matrix = parseCsvText(text);
  } else if (nameLower.endsWith('.xlsx')) {
    matrix = await readSheet(file);
  } else {
    throw new Error('Unsupported file format. Please upload an .xlsx or .csv file.');
  }

  const nonEmpty = matrix.filter((r) => r.some((cell) => cell !== null && String(cell ?? '').trim() !== ''));
  if (nonEmpty.length < 2) {
    throw new Error('The file must contain a header row and at least one task data row.');
  }

  const headers = nonEmpty[0].map(normalizeHeader);
  const colIndex = (candidates: string[]) =>
    headers.findIndex((h) => candidates.some((c) => h === c || h.includes(c)));

  const idxTitle = colIndex(['title', 'tasktitle', 'taskname', 'name']);
  const idxDesc = colIndex(['description', 'desc', 'details', 'notes']);
  const idxCat = colIndex(['category', 'taskcategory', 'type']);
  const idxPriority = colIndex(['priority', 'urgency']);
  const idxStatus = colIndex(['status', 'state']);
  const idxDept = colIndex(['department', 'dept']);
  const idxArea = colIndex(['area', 'region']);
  const idxBranch = colIndex(['branch', 'hub']);
  const idxOutlet = colIndex(['outlet', 'store', 'site', 'bay']);
  const idxSla = colIndex(['slahours', 'sla']);
  const idxDue = colIndex(['duedate', 'due', 'deadline']);
  const idxAssignee = colIndex(['assigneeemail', 'assignee', 'assignedto', 'owner']);

  if (idxTitle === -1) {
    throw new Error('Missing required "Title" column in header row.');
  }

  const canAssign = currentUser?.role === 'Admin' || currentUser?.role === 'Supervisor';
  const results: ParsedImportRow[] = [];

  for (let i = 1; i < nonEmpty.length; i++) {
    const row = nonEmpty[i];
    const rowNumber = i + 1;
    const title = parseCellString(row[idxTitle]);
    const description = idxDesc >= 0 ? parseCellString(row[idxDesc]) : '';
    const category =
      (idxCat >= 0 ? parseCellString(row[idxCat]) : '') || TASK_CATEGORIES[0];
    const priority = matchPriority(idxPriority >= 0 ? parseCellString(row[idxPriority]) : '');
    const status = matchStatus(idxStatus >= 0 ? parseCellString(row[idxStatus]) : '');
    const department =
      (idxDept >= 0 ? parseCellString(row[idxDept]) : '') ||
      currentUser?.department ||
      DEPARTMENTS[0];
    const area =
      (idxArea >= 0 ? parseCellString(row[idxArea]) : '') ||
      currentUser?.area ||
      AREAS[0];
    const branch =
      (idxBranch >= 0 ? parseCellString(row[idxBranch]) : '') ||
      currentUser?.branch ||
      BRANCHES[0];
    const outlet =
      (idxOutlet >= 0 ? parseCellString(row[idxOutlet]) : '') ||
      currentUser?.outlet ||
      OUTLETS[0];

    const rawSla = idxSla >= 0 ? Number(row[idxSla]) : NaN;
    const slaHours =
      Number.isFinite(rawSla) && rawSla >= 1 && rawSla <= 8760
        ? Math.round(rawSla)
        : SLA_HOURS_BY_PRIORITY[priority];

    const dueDate = idxDue >= 0 ? parseDueDate(row[idxDue]) : null;
    const rawAssignee = idxAssignee >= 0 ? parseCellString(row[idxAssignee]) : '';

    let assigneeId: string | null = null;
    let assigneeLabel = 'Unassigned';

    if (rawAssignee) {
      const matched = users.find(
        (u) =>
          u.email.toLowerCase() === rawAssignee.toLowerCase() ||
          u.fullName.toLowerCase() === rawAssignee.toLowerCase()
      );
      if (matched) {
        if (canAssign || matched.id === currentUser?.id) {
          assigneeId = matched.id;
          assigneeLabel = matched.fullName;
        } else {
          assigneeId = currentUser?.id ?? null;
          assigneeLabel = `${currentUser?.fullName ?? 'Self'} (RBAC self-assigned)`;
        }
      } else {
        assigneeLabel = `Unassigned ("${rawAssignee}" not found)`;
      }
    }

    const valid = title.length >= 2;
    results.push({
      rowNumber,
      valid,
      error: valid ? undefined : 'Title must be at least 2 characters.',
      assigneeLabel,
      payload: {
        title,
        description,
        category,
        priority,
        status,
        department,
        area,
        branch,
        outlet,
        slaHours,
        dueDate,
        assigneeId,
      },
    });
  }

  return results;
}

export async function exportTasksToExcel(
  tasks: Task[],
  fileName = 'opex-tasks-export.xlsx'
): Promise<void> {
  const headers = [
    'Task Code',
    'Title',
    'Description',
    'Category',
    'Status',
    'Priority',
    'SLA Hours',
    'SLA Status',
    'Age (Days)',
    'Area',
    'Branch',
    'Outlet',
    'Department',
    'Assignee',
    'Created By',
    'Due Date',
    'Completed At',
    'Created At',
  ];

  const headerRow = headers.map((h) => ({
    value: h,
    fontWeight: 'bold' as const,
    backgroundColor: '#EFF6FF',
    color: '#0F172A',
  }));

  const dataRows = tasks.map((t) => [
    { value: t.taskCode, type: String },
    { value: safeCellText(t.title), type: String },
    { value: safeCellText(t.description), type: String },
    { value: safeCellText(t.category), type: String },
    { value: t.status, type: String },
    { value: t.priority, type: String },
    { value: t.slaHours, type: Number },
    { value: getTaskSlaInfo(t).status, type: String },
    { value: getTaskAgeDays(t), type: Number },
    { value: safeCellText(t.area), type: String },
    { value: safeCellText(t.branch), type: String },
    { value: safeCellText(t.outlet), type: String },
    { value: safeCellText(t.department), type: String },
    { value: safeCellText(t.assigneeName ?? 'Unassigned'), type: String },
    { value: safeCellText(t.createdByName ?? ''), type: String },
    { value: t.dueDate ?? '', type: String },
    { value: t.completedAt ? t.completedAt.slice(0, 10) : '', type: String },
    { value: t.createdAt.slice(0, 10), type: String },
  ]);

  await writeXlsxFile([headerRow, ...dataRows], {
    sheet: 'OpEx Tasks',
    stickyRowsCount: 1,
    columns: [
      { width: 12 },
      { width: 38 },
      { width: 42 },
      { width: 22 },
      { width: 14 },
      { width: 12 },
      { width: 11 },
      { width: 13 },
      { width: 11 },
      { width: 16 },
      { width: 22 },
      { width: 26 },
      { width: 20 },
      { width: 20 },
      { width: 18 },
      { width: 13 },
      { width: 14 },
      { width: 14 },
    ],
  }).toFile(fileName);
}

export async function downloadExcelImportTemplate(): Promise<void> {
  const headers = [
    'Title',
    'Description',
    'Category',
    'Priority',
    'Status',
    'Area',
    'Branch',
    'Outlet',
    'Department',
    'SLA Hours',
    'Due Date',
    'Assignee',
  ];

  const headerRow = headers.map((h) => ({
    value: h,
    fontWeight: 'bold' as const,
    backgroundColor: '#EFF6FF',
    color: '#0F172A',
  }));

  const nextWeek = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  const twoDays = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);

  const sampleRows = [
    [
      { value: 'Refrigeration Unit Compressor Inspection', type: String },
      { value: 'Check suction pressure and clean condenser coils.', type: String },
      { value: 'Preventive Maintenance', type: String },
      { value: 'High', type: String },
      { value: 'Open', type: String },
      { value: 'Region West', type: String },
      { value: 'North Hub Branch', type: String },
      { value: 'Outlet 01 - Flagship Plaza', type: String },
      { value: 'Facility Fleet', type: String },
      { value: 48, type: Number },
      { value: twoDays, type: String },
      { value: 'daniel.ortiz@opex.local', type: String },
    ],
    [
      { value: 'Weekly Cycle Count Spot Check', type: String },
      { value: 'Audit high-value SKU bins and upload discrepancy report.', type: String },
      { value: 'Inventory & Stock', type: String },
      { value: 'Medium', type: String },
      { value: 'Open', type: String },
      { value: 'Region Central', type: String },
      { value: 'Central Metro Branch', type: String },
      { value: 'Outlet 04 - Harbor Bay', type: String },
      { value: 'Supply Chain', type: String },
      { value: 72, type: Number },
      { value: nextWeek, type: String },
      { value: 'Priya Nair', type: String },
    ],
  ];

  await writeXlsxFile([headerRow, ...sampleRows], {
    sheet: 'Import Template',
    stickyRowsCount: 1,
    columns: [
      { width: 38 },
      { width: 42 },
      { width: 22 },
      { width: 12 },
      { width: 14 },
      { width: 16 },
      { width: 22 },
      { width: 26 },
      { width: 20 },
      { width: 12 },
      { width: 14 },
      { width: 24 },
    ],
  }).toFile('opex-task-import-template.xlsx');
}
