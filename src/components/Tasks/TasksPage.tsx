import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ChatBubbleOutlinedIcon from '@mui/icons-material/ChatBubbleOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SearchIcon from '@mui/icons-material/Search';
import TableRowsOutlinedIcon from '@mui/icons-material/TableRowsOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import ViewKanbanOutlinedIcon from '@mui/icons-material/ViewKanbanOutlined';
import { useAuth } from '../../context/AuthContext';
import { exportTasksToExcel } from '../../services/excelService';
import {
  canUserDeleteTask,
  canUserEditTask,
  formatTaskAge,
  getTaskAgeHours,
  getTaskSlaInfo,
  isTaskDueSoon,
  isTaskOverdue,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type CreateTaskInput,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type UserProfile,
} from '../../types';
import { ExcelImportDialog } from './ExcelImportDialog';
import { TaskPriorityMark, TaskSlaMark, TaskStatusMark } from './TaskStatusMark';

export type TaskStatusFilterValue = TaskStatus | 'All' | 'Overdue' | 'Due Soon';

interface TasksPageProps {
  tasks: Task[];
  users: UserProfile[];
  statusFilter: TaskStatusFilterValue;
  onStatusFilterChange: (next: TaskStatusFilterValue) => void;
  onSelectTask: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => Promise<void>;
  onCreateNew: () => void;
  onImportTasks: (rows: CreateTaskInput[]) => Promise<void>;
}

export function TasksPage({
  tasks,
  users,
  statusFilter,
  onStatusFilterChange,
  onSelectTask,
  onEditTask,
  onDeleteTask,
  onCreateNew,
  onImportTasks,
}: TasksPageProps) {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'table' | 'board'>('table');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'All'>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [areaFilter, setAreaFilter] = useState<string>('All');
  const [branchFilter, setBranchFilter] = useState<string>('All');
  const [outletFilter, setOutletFilter] = useState<string>('All');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('All');
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const categoryOptions = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.category).filter(Boolean))).sort(),
    [tasks]
  );
  const areaOptions = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.area).filter(Boolean))).sort(),
    [tasks]
  );
  const branchOptions = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.branch).filter(Boolean))).sort(),
    [tasks]
  );
  const outletOptions = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.outlet).filter(Boolean))).sort(),
    [tasks]
  );

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (statusFilter === 'Overdue') {
        if (!isTaskOverdue(t)) return false;
      } else if (statusFilter === 'Due Soon') {
        if (isTaskOverdue(t) || !isTaskDueSoon(t)) return false;
      } else if (statusFilter !== 'All' && t.status !== statusFilter) {
        return false;
      }
      if (priorityFilter !== 'All' && t.priority !== priorityFilter) return false;
      if (categoryFilter !== 'All' && t.category !== categoryFilter) return false;
      if (areaFilter !== 'All' && t.area !== areaFilter) return false;
      if (branchFilter !== 'All' && t.branch !== branchFilter) return false;
      if (outletFilter !== 'All' && t.outlet !== outletFilter) return false;
      if (assigneeFilter === 'Unassigned' && t.assigneeId !== null) return false;
      if (
        assigneeFilter !== 'All' &&
        assigneeFilter !== 'Unassigned' &&
        t.assigneeId !== assigneeFilter
      ) {
        return false;
      }
      if (q) {
        const hay =
          `${t.taskCode} ${t.title} ${t.description} ${t.category} ${t.department} ${t.area} ${t.branch} ${t.outlet} ${t.assigneeName ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    tasks,
    statusFilter,
    priorityFilter,
    categoryFilter,
    areaFilter,
    branchFilter,
    outletFilter,
    assigneeFilter,
    search,
  ]);

  const filterButtons: TaskStatusFilterValue[] = [
    'All',
    ...TASK_STATUSES,
    'Due Soon',
    'Overdue',
  ];

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      await exportTasksToExcel(filteredTasks, 'opex-tasks-export.xlsx');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      {/* Header */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' } }}
      >
        <Box>
          <Typography variant="h4" sx={{ color: '#0F172A' }}>
            Operational Tasks
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {filteredTasks.length} of {tasks.length} tasks displayed
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.25} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<UploadFileOutlinedIcon fontSize="small" />}
            onClick={() => setImportOpen(true)}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Import Excel
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadOutlinedIcon fontSize="small" />}
            disabled={exporting || filteredTasks.length === 0}
            onClick={handleExportExcel}
            sx={{ whiteSpace: 'nowrap' }}
          >
            {exporting ? 'Exporting...' : 'Export Excel'}
          </Button>

          <ToggleButtonGroup
            size="small"
            value={viewMode}
            exclusive
            onChange={(_, val) => val && setViewMode(val)}
            sx={{ bgcolor: '#FFFFFF' }}
          >
            <ToggleButton value="table" sx={{ gap: 0.75, px: 1.5 }}>
              <TableRowsOutlinedIcon fontSize="small" />
              Table
            </ToggleButton>
            <ToggleButton value="board" sx={{ gap: 0.75, px: 1.5 }}>
              <ViewKanbanOutlinedIcon fontSize="small" />
              Board
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Stack>

      {/* Toolbar: Segmented Status Filter + Search & Category/Location Dropdowns */}
      <Paper sx={{ p: 2 }}>
        <Stack spacing={1.75}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {filterButtons.map((opt) => {
              const active = statusFilter === opt;
              const isOverdueBtn = opt === 'Overdue';
              const isDueSoonBtn = opt === 'Due Soon';
              return (
                <Button
                  key={opt}
                  size="small"
                  variant={active ? 'contained' : 'text'}
                  color={active ? 'primary' : 'inherit'}
                  onClick={() => onStatusFilterChange(opt)}
                  sx={{
                    minHeight: 32,
                    px: 1.5,
                    whiteSpace: 'nowrap',
                    color: active
                      ? '#FFFFFF'
                      : isOverdueBtn
                        ? '#DC2626'
                        : isDueSoonBtn
                          ? '#D97706'
                          : '#475569',
                    bgcolor: active
                      ? isOverdueBtn
                        ? '#DC2626'
                        : isDueSoonBtn
                          ? '#D97706'
                          : '#1D4ED8'
                      : '#F8FAFC',
                    '&:hover': {
                      bgcolor: active ? undefined : '#E2E8F0',
                    },
                  }}
                >
                  {opt}
                </Button>
              );
            })}
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                lg: '2fr repeat(5, 1fr)',
              },
              gap: 1.25,
            }}
          >
            <TextField
              size="small"
              fullWidth
              placeholder="Search code, title, category, area, branch, outlet..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" sx={{ color: '#64748B' }} />
                    </InputAdornment>
                  ),
                },
              }}
            />

            <TextField
              select
              size="small"
              label="Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <MenuItem value="All">All Categories</MenuItem>
              {categoryOptions.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label="Area"
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
            >
              <MenuItem value="All">All Areas</MenuItem>
              {areaOptions.map((a) => (
                <MenuItem key={a} value={a}>
                  {a}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label="Branch"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
            >
              <MenuItem value="All">All Branches</MenuItem>
              {branchOptions.map((b) => (
                <MenuItem key={b} value={b}>
                  {b}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label="Outlet"
              value={outletFilter}
              onChange={(e) => setOutletFilter(e.target.value)}
            >
              <MenuItem value="All">All Outlets</MenuItem>
              {outletOptions.map((o) => (
                <MenuItem key={o} value={o}>
                  {o}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label="Priority"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | 'All')}
            >
              <MenuItem value="All">All Priorities</MenuItem>
              {TASK_PRIORITIES.map((p) => (
                <MenuItem key={p} value={p}>
                  {p}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
            <TextField
              select
              size="small"
              label="Assignee"
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              sx={{ minWidth: { xs: '100%', sm: 240 } }}
            >
              <MenuItem value="All">All Assignees</MenuItem>
              <MenuItem value="Unassigned">Unassigned</MenuItem>
              {users.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.fullName}
                </MenuItem>
              ))}
            </TextField>

            {(categoryFilter !== 'All' ||
              areaFilter !== 'All' ||
              branchFilter !== 'All' ||
              outletFilter !== 'All' ||
              priorityFilter !== 'All' ||
              assigneeFilter !== 'All' ||
              statusFilter !== 'All' ||
              search) && (
              <Button
                size="small"
                color="inherit"
                onClick={() => {
                  setSearch('');
                  setPriorityFilter('All');
                  setCategoryFilter('All');
                  setAreaFilter('All');
                  setBranchFilter('All');
                  setOutletFilter('All');
                  setAssigneeFilter('All');
                  onStatusFilterChange('All');
                }}
              >
                Reset Filters
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {/* Content View */}
      {filteredTasks.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center' }}>
          <Typography variant="h6" sx={{ mb: 0.75 }}>
            No matching tasks found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Adjust your active filters or create a new operational task.
          </Typography>
          <Button variant="contained" onClick={onCreateNew}>
            Create Task
          </Button>
        </Paper>
      ) : viewMode === 'table' ? (
        <Paper sx={{ overflow: 'hidden' }}>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Task & Location Assignment</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>SLA / Aging</TableCell>
                  <TableCell>Assignee</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell align="center">Files / Notes</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTasks.map((t) => {
                  const overdue = isTaskOverdue(t);
                  const dueSoon = !overdue && isTaskDueSoon(t);
                  const sla = getTaskSlaInfo(t);
                  const ageStr = formatTaskAge(getTaskAgeHours(t));
                  const canEdit = canUserEditTask(user, t);
                  const canDel = canUserDeleteTask(user, t);
                  return (
                    <TableRow
                      key={t.id}
                      hover
                      onClick={() => onSelectTask(t)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell
                        className="font-mono-num"
                        sx={{ fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}
                      >
                        {t.taskCode}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 290 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A' }} noWrap>
                          {t.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                          {t.area} · {t.branch} · {t.outlet}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', color: '#334155', fontSize: '0.8125rem' }}>
                        {t.category}
                      </TableCell>
                      <TableCell>
                        <TaskStatusMark status={t.status} />
                      </TableCell>
                      <TableCell>
                        <TaskPriorityMark priority={t.priority} />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <TaskSlaMark slaStatus={sla.status} />
                        <Typography
                          variant="caption"
                          className="font-mono-num"
                          color="text.secondary"
                          sx={{ display: 'block' }}
                        >
                          Age {ageStr} · {sla.slaHours}h SLA
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', color: '#334155' }}>
                        {t.assigneeName ?? 'Unassigned'}
                      </TableCell>
                      <TableCell
                        className="font-mono-num"
                        sx={{
                          whiteSpace: 'nowrap',
                          color: overdue ? '#DC2626' : dueSoon ? '#D97706' : '#475569',
                          fontWeight: overdue || dueSoon ? 600 : 400,
                        }}
                      >
                        {t.dueDate
                          ? `${t.dueDate}${overdue ? ' · Overdue' : dueSoon ? ' · Due Soon' : ''}`
                          : '—'}
                      </TableCell>
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                        <Stack
                          direction="row"
                          spacing={1.25}
                          sx={{ justifyContent: 'center', alignItems: 'center', color: '#64748B' }}
                        >
                          <Stack direction="row" spacing={0.35} sx={{ alignItems: 'center' }}>
                            <AttachFileIcon sx={{ fontSize: 14 }} />
                            <span className="font-mono-num" style={{ fontSize: '0.75rem' }}>
                              {t.attachmentCount ?? 0}
                            </span>
                          </Stack>
                          <Stack direction="row" spacing={0.35} sx={{ alignItems: 'center' }}>
                            <ChatBubbleOutlinedIcon sx={{ fontSize: 14 }} />
                            <span className="font-mono-num" style={{ fontSize: '0.75rem' }}>
                              {t.commentCount ?? 0}
                            </span>
                          </Stack>
                        </Stack>
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ whiteSpace: 'nowrap' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {canEdit && (
                          <IconButton
                            aria-label={`Edit ${t.taskCode}`}
                            size="small"
                            onClick={() => onEditTask(t)}
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        )}
                        {canDel && (
                          <IconButton
                            aria-label={`Delete ${t.taskCode}`}
                            size="small"
                            color="error"
                            onClick={() => onDeleteTask(t.id)}
                          >
                            <DeleteOutlinedIcon fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      ) : (
        /* Kanban Board View */
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(3, 1fr)',
              xl: 'repeat(5, 1fr)',
            },
            gap: 2,
            alignItems: 'start',
          }}
        >
          {TASK_STATUSES.map((colStatus) => {
            const colTasks = filteredTasks.filter((t) => t.status === colStatus);
            return (
              <Paper key={colStatus} sx={{ p: 1.5, bgcolor: '#F8FAFC' }}>
                <Stack
                  direction="row"
                  sx={{
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    px: 0.75,
                    pb: 1.25,
                    mb: 1.25,
                    borderBottom: '1px solid #E2E8F0',
                  }}
                >
                  <TaskStatusMark status={colStatus} />
                  <Typography variant="caption" className="font-mono-num" sx={{ fontWeight: 700, color: '#64748B' }}>
                    {colTasks.length}
                  </Typography>
                </Stack>
                <Stack spacing={1.25}>
                  {colTasks.length === 0 ? (
                    <Typography variant="caption" color="text.secondary" sx={{ p: 1, textAlign: 'center' }}>
                      No tasks
                    </Typography>
                  ) : (
                    colTasks.map((t) => {
                      const overdue = isTaskOverdue(t);
                      const dueSoon = !overdue && isTaskDueSoon(t);
                      const sla = getTaskSlaInfo(t);
                      return (
                        <Paper
                          key={t.id}
                          onClick={() => onSelectTask(t)}
                          sx={{
                            p: 1.75,
                            cursor: 'pointer',
                            bgcolor: '#FFFFFF',
                            '&:hover': { borderColor: '#94A3B8' },
                          }}
                        >
                          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                            <Typography variant="caption" className="font-mono-num" sx={{ fontWeight: 600, color: '#64748B' }}>
                              {t.taskCode} · {formatTaskAge(getTaskAgeHours(t))}
                            </Typography>
                            <TaskPriorityMark priority={t.priority} />
                          </Stack>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A', mb: 0.5 }}>
                            {t.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                            {t.category} · {t.branch} · {t.outlet}
                          </Typography>
                          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                            <TaskSlaMark slaStatus={sla.status} />
                            <span
                              className="font-mono-num"
                              style={{
                                color: overdue ? '#DC2626' : dueSoon ? '#D97706' : '#64748B',
                                fontWeight: overdue || dueSoon ? 600 : 400,
                              }}
                            >
                              {t.dueDate ?? '—'}
                            </span>
                          </Stack>
                        </Paper>
                      );
                    })
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Box>
      )}

      <ExcelImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        users={users}
        onImportConfirm={onImportTasks}
      />
    </Stack>
  );
}
