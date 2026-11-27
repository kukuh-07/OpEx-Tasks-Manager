import React, { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useAuth } from '../../context/AuthContext';
import {
  AREAS,
  BRANCHES,
  canUserAssignTask,
  DEPARTMENTS,
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
} from '../../types';

interface TaskFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (payload: CreateTaskInput) => Promise<void>;
  users: UserProfile[];
  initialTask?: Task | null;
}

export function TaskFormDialog({
  open,
  onClose,
  onSave,
  users,
  initialTask,
}: TaskFormDialogProps) {
  const { user } = useAuth();
  const canAssign = canUserAssignTask(user);
  const activeUsers = users.filter((u) => u.status === 'Active');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(TASK_CATEGORIES[0]);
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [status, setStatus] = useState<TaskStatus>('Open');
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [area, setArea] = useState(AREAS[0]);
  const [branch, setBranch] = useState(BRANCHES[0]);
  const [outlet, setOutlet] = useState(OUTLETS[0]);
  const [slaHours, setSlaHours] = useState<number>(SLA_HOURS_BY_PRIORITY.Medium);
  const [slaTouched, setSlaTouched] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initialTask) {
      setTitle(initialTask.title);
      setDescription(initialTask.description);
      setCategory(initialTask.category || TASK_CATEGORIES[0]);
      setPriority(initialTask.priority);
      setStatus(initialTask.status);
      setDepartment(initialTask.department);
      setArea(initialTask.area || AREAS[0]);
      setBranch(initialTask.branch || BRANCHES[0]);
      setOutlet(initialTask.outlet || OUTLETS[0]);
      setSlaHours(initialTask.slaHours || SLA_HOURS_BY_PRIORITY[initialTask.priority]);
      setSlaTouched(true);
      setDueDate(initialTask.dueDate ?? '');
      setAssigneeId(initialTask.assigneeId ?? '');
    } else {
      setTitle('');
      setDescription('');
      setCategory(TASK_CATEGORIES[0]);
      setPriority('Medium');
      setStatus('Open');
      setDepartment(user?.department || DEPARTMENTS[0]);
      setArea(user?.area || AREAS[0]);
      setBranch(user?.branch || BRANCHES[0]);
      setOutlet(user?.outlet || OUTLETS[0]);
      setSlaHours(SLA_HOURS_BY_PRIORITY.Medium);
      setSlaTouched(false);
      setDueDate('');
      setAssigneeId(canAssign ? '' : user?.id ?? '');
    }
  }, [open, initialTask, user, canAssign]);

  const handlePriorityChange = (nextPriority: TaskPriority) => {
    setPriority(nextPriority);
    if (!slaTouched) {
      setSlaHours(SLA_HOURS_BY_PRIORITY[nextPriority]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2) {
      setError('Task title must be at least 2 characters.');
      return;
    }
    const parsedSla = Number(slaHours);
    if (!Number.isFinite(parsedSla) || parsedSla < 1 || parsedSla > 8760) {
      setError('SLA target must be between 1 and 8,760 hours.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        status,
        department,
        area,
        branch,
        outlet,
        slaHours: Math.round(parsedSla),
        dueDate: dueDate || null,
        assigneeId: assigneeId || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 700, borderBottom: '1px solid #E2E8F0' }}>
        {initialTask ? `Edit Task · ${initialTask.taskCode}` : 'Create Operational Task'}
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 2.5 }}>
          <Stack spacing={2.25}>
            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              label="Task Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              fullWidth
              size="small"
              placeholder="e.g., Cold-chain sensor calibration for Bay A"
            />

            <TextField
              label="Operational Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={3}
              fullWidth
              size="small"
              placeholder="Scope, acceptance criteria, and reference SOPs..."
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                label="Task Category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                fullWidth
                size="small"
              >
                {Array.from(new Set([category, ...TASK_CATEGORIES])).map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                fullWidth
                size="small"
              >
                {Array.from(new Set([department, ...DEPARTMENTS])).map((d) => (
                  <MenuItem key={d} value={d}>
                    {d}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                label="Priority"
                value={priority}
                onChange={(e) => handlePriorityChange(e.target.value as TaskPriority)}
                fullWidth
                size="small"
              >
                {TASK_PRIORITIES.map((p) => (
                  <MenuItem key={p} value={p}>
                    {p}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                fullWidth
                size="small"
              >
                {TASK_STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="SLA Target (Hours)"
                type="number"
                value={slaHours}
                onChange={(e) => {
                  setSlaTouched(true);
                  setSlaHours(Number(e.target.value));
                }}
                slotProps={{ htmlInput: { min: 1, max: 8760 } }}
                fullWidth
                size="small"
              />

              <TextField
                label="Due Date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                fullWidth
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>

            <Divider />

            <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
              Location & Team Assignment
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                label="Area Assignment"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                fullWidth
                size="small"
              >
                {Array.from(new Set([area, ...AREAS])).map((a) => (
                  <MenuItem key={a} value={a}>
                    {a}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Branch Assignment"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                fullWidth
                size="small"
              >
                {Array.from(new Set([branch, ...BRANCHES])).map((b) => (
                  <MenuItem key={b} value={b}>
                    {b}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Outlet Assignment"
                value={outlet}
                onChange={(e) => setOutlet(e.target.value)}
                fullWidth
                size="small"
              >
                {Array.from(new Set([outlet, ...OUTLETS])).map((o) => (
                  <MenuItem key={o} value={o}>
                    {o}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <TextField
              select
              label="Assignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              fullWidth
              size="small"
              disabled={!canAssign}
              helperText={
                !canAssign
                  ? 'Members can self-assign tasks; Admins and Supervisors can assign across the team.'
                  : undefined
              }
            >
              <MenuItem value="">Unassigned</MenuItem>
              {activeUsers.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.fullName} ({u.role} · {u.branch})
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #E2E8F0' }}>
          <Button onClick={onClose} color="inherit" disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? 'Saving...' : initialTask ? 'Save Changes' : 'Create Task'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
