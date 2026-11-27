import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ReplyOutlinedIcon from '@mui/icons-material/ReplyOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import { useAuth } from '../../context/AuthContext';
import { attachmentService } from '../../services/attachmentService';
import { commentService } from '../../services/commentService';
import { taskService } from '../../services/taskService';
import {
  canUserAssignTask,
  canUserDeleteTask,
  canUserEditTask,
  formatTaskAge,
  getDaysUntilDue,
  getTaskAgeHours,
  getTaskAgingBucket,
  getTaskSlaInfo,
  isTaskDueSoon,
  isTaskOverdue,
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Task,
  type TaskActivityLog,
  type TaskAttachment,
  type TaskComment,
  type TaskPriority,
  type TaskStatus,
  type UpdateTaskInput,
  type UserProfile,
} from '../../types';
import {
  formatBytes,
  formatTimestamp,
  TaskPriorityMark,
  TaskSlaMark,
  TaskStatusMark,
} from './TaskStatusMark';

interface TaskDetailDrawerProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  users: UserProfile[];
  onUpdateTask: (id: string, updates: UpdateTaskInput) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onOpenEditModal: (task: Task) => void;
}

export function TaskDetailDrawer({
  task,
  open,
  onClose,
  users,
  onUpdateTask,
  onDeleteTask,
  onOpenEditModal,
}: TaskDetailDrawerProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<'comments' | 'attachments' | 'activity'>('comments');
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [activities, setActivities] = useState<TaskActivityLog[]>([]);
  const [loadingSub, setLoadingSub] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [commentBody, setCommentBody] = useState('');
  const [replyTo, setReplyTo] = useState<TaskComment | null>(null);
  const [postingComment, setPostingComment] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadDetails = useCallback(async (taskId: string) => {
    setLoadingSub(true);
    setError(null);
    try {
      const [c, a, act] = await Promise.all([
        commentService.listByTask(taskId),
        attachmentService.listByTask(taskId),
        taskService.getActivity(taskId),
      ]);
      setComments(c);
      setAttachments(a);
      setActivities(act);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task details.');
    } finally {
      setLoadingSub(false);
    }
  }, []);

  useEffect(() => {
    if (open && task) {
      setReplyTo(null);
      setCommentBody('');
      loadDetails(task.id);
    }
  }, [open, task, loadDetails]);

  const topComments = useMemo(
    () => comments.filter((c) => !c.parentId),
    [comments]
  );

  const repliesByParent = useMemo(() => {
    const map = new Map<string, TaskComment[]>();
    for (const c of comments) {
      if (c.parentId) {
        const arr = map.get(c.parentId) ?? [];
        arr.push(c);
        map.set(c.parentId, arr);
      }
    }
    return map;
  }, [comments]);

  if (!task) return null;

  const canEdit = canUserEditTask(user, task);
  const canDelete = canUserDeleteTask(user, task);
  const canAssign = canUserAssignTask(user);
  const overdue = isTaskOverdue(task);
  const dueSoon = !overdue && isTaskDueSoon(task);
  const daysLeft = getDaysUntilDue(task.dueDate);
  const ageHours = getTaskAgeHours(task);
  const agingBucket = getTaskAgingBucket(task);
  const sla = getTaskSlaInfo(task);
  const activeUsers = users.filter((u) => u.status === 'Active');

  const slaBarColor =
    sla.status === 'Breached'
      ? '#DC2626'
      : sla.status === 'At Risk'
        ? '#D97706'
        : '#16A34A';

  const handleQuickChange = async (updates: UpdateTaskInput) => {
    setError(null);
    try {
      await onUpdateTask(task.id, updates);
      const act = await taskService.getActivity(task.id);
      setActivities(act);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task.');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setPostingComment(true);
    setError(null);
    try {
      const created = await commentService.create(
        task.id,
        commentBody.trim(),
        replyTo?.id ?? null
      );
      setComments((prev) => [...prev, created]);
      setCommentBody('');
      setReplyTo(null);
      const act = await taskService.getActivity(task.id);
      setActivities(act);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment.');
    } finally {
      setPostingComment(false);
    }
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingFile(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const uploaded = await attachmentService.upload(task.id, file);
        setAttachments((prev) => [uploaded, ...prev]);
      }
      const act = await taskService.getActivity(task.id);
      setActivities(act);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'File upload failed.');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (att: TaskAttachment) => {
    setError(null);
    try {
      await attachmentService.download(att);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed.');
    }
  };

  const handleDeleteAttachment = async (att: TaskAttachment) => {
    setError(null);
    try {
      await attachmentService.remove(att);
      setAttachments((prev) => prev.filter((item) => item.id !== att.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove attachment.');
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            width: { xs: '100%', sm: 560, md: 640 },
            borderLeft: '1px solid #E2E8F0',
            display: 'flex',
            flexDirection: 'column',
          },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
          <Typography
            className="font-mono-num"
            sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569', flexShrink: 0 }}
          >
            {task.taskCode}
          </Typography>
          <Typography sx={{ color: '#CBD5E1' }}>·</Typography>
          <Typography variant="body2" sx={{ color: '#64748B' }} noWrap>
            {task.category} · {task.department}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          {canEdit && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditOutlinedIcon fontSize="small" />}
              onClick={() => onOpenEditModal(task)}
            >
              Edit
            </Button>
          )}
          {canDelete && (
            <IconButton
              aria-label="Delete task"
              color="error"
              size="small"
              onClick={async () => {
                await onDeleteTask(task.id);
                onClose();
              }}
            >
              <DeleteOutlinedIcon fontSize="small" />
            </IconButton>
          )}
          <IconButton aria-label="Close drawer" onClick={onClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      {/* Scrollable Body */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {overdue && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Overdue Alert: Due date {task.dueDate} has passed ({Math.abs(daysLeft ?? 0)} days overdue).
          </Alert>
        )}

        {dueSoon && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Due Soon Alert: Due {daysLeft === 0 ? 'today' : `in ${daysLeft} day(s)`} ({task.dueDate}).
          </Alert>
        )}

        <Typography variant="h5" sx={{ color: '#0F172A', mb: 1, lineHeight: 1.3 }}>
          {task.title}
        </Typography>

        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 2, color: '#64748B', fontSize: '0.8125rem' }}
        >
          <TaskStatusMark status={task.status} />
          <span aria-hidden="true">·</span>
          <TaskPriorityMark priority={task.priority} />
          <span aria-hidden="true">·</span>
          <TaskSlaMark slaStatus={sla.status} />
          <span aria-hidden="true">·</span>
          <span
            className="font-mono-num"
            style={{
              color: overdue ? '#DC2626' : dueSoon ? '#D97706' : '#475569',
              fontWeight: overdue || dueSoon ? 600 : 400,
            }}
          >
            {task.dueDate ? `Due ${task.dueDate}` : 'No due date'}
          </span>
        </Stack>

        <Typography
          variant="body2"
          sx={{
            color: '#334155',
            lineHeight: 1.65,
            mb: 2.5,
            whiteSpace: 'pre-wrap',
          }}
        >
          {task.description || 'No description provided.'}
        </Typography>

        {/* Location Assignment & SLA / Aging Telemetry */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 2,
            p: 2,
            mb: 2.5,
            bgcolor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: 1.5,
          }}
        >
          <Box>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, display: 'block', mb: 0.5 }}>
              Area / Branch / Outlet Assignment
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A' }}>
              {task.area} · {task.branch}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {task.outlet}
            </Typography>
          </Box>

          <Box>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
                SLA Window ({sla.slaHours}h) & Task Aging
              </Typography>
              <Typography variant="caption" className="font-mono-num" sx={{ fontWeight: 600, color: '#0F172A' }}>
                Age: {formatTaskAge(ageHours)} ({agingBucket})
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={sla.progressPct}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: '#E2E8F0',
                mb: 0.5,
                '& .MuiLinearProgress-bar': { bgcolor: slaBarColor },
              }}
            />
            <Typography variant="caption" className="font-mono-num" sx={{ color: slaBarColor, fontWeight: 600 }}>
              {sla.status === 'Cancelled'
                ? 'SLA Cancelled'
                : sla.status === 'Met'
                  ? `Completed in ${formatTaskAge(sla.elapsedHours)}`
                  : sla.remainingHours < 0
                    ? `Breached by ${formatTaskAge(Math.abs(sla.remainingHours))}`
                    : `${formatTaskAge(sla.remainingHours)} remaining`}
            </Typography>
          </Box>
        </Box>

        {/* Inline Operational Controls */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1.5,
            p: 2,
            bgcolor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: 1.5,
            mb: 3,
          }}
        >
          <TextField
            select
            label="Status"
            size="small"
            value={task.status}
            disabled={!canEdit}
            onChange={(e) => handleQuickChange({ status: e.target.value as TaskStatus })}
            sx={{ bgcolor: '#FFFFFF' }}
          >
            {TASK_STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Priority"
            size="small"
            value={task.priority}
            disabled={!canEdit}
            onChange={(e) => handleQuickChange({ priority: e.target.value as TaskPriority })}
            sx={{ bgcolor: '#FFFFFF' }}
          >
            {TASK_PRIORITIES.map((p) => (
              <MenuItem key={p} value={p}>
                {p}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Category"
            size="small"
            value={task.category}
            disabled={!canEdit}
            onChange={(e) => handleQuickChange({ category: e.target.value })}
            sx={{ bgcolor: '#FFFFFF' }}
          >
            {Array.from(new Set([task.category, ...TASK_CATEGORIES])).map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Assignee"
            size="small"
            value={task.assigneeId ?? ''}
            disabled={!canAssign}
            onChange={(e) => handleQuickChange({ assigneeId: e.target.value || null })}
            sx={{ bgcolor: '#FFFFFF' }}
          >
            <MenuItem value="">Unassigned</MenuItem>
            {activeUsers.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.fullName}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        {/* Sub-Navigation Tabs */}
        <Tabs
          value={tab}
          onChange={(_, val) => setTab(val)}
          sx={{ borderBottom: '1px solid #E2E8F0', mb: 2.5 }}
        >
          <Tab label={`Comments (${comments.length})`} value="comments" />
          <Tab label={`Attachments (${attachments.length})`} value="attachments" />
          <Tab label={`Activity (${activities.length})`} value="activity" />
        </Tabs>

        {loadingSub ? (
          <Typography variant="body2" color="text.secondary">
            Loading task records...
          </Typography>
        ) : null}

        {/* Comments Tab */}
        {!loadingSub && tab === 'comments' && (
          <Box>
            <Box component="form" onSubmit={handleAddComment} sx={{ mb: 3 }}>
              {replyTo && (
                <Stack
                  direction="row"
                  sx={{
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    px: 1.5,
                    py: 0.75,
                    mb: 1,
                    bgcolor: '#EFF6FF',
                    borderRadius: 1,
                    border: '1px solid #BFDBFE',
                  }}
                >
                  <Typography variant="caption" sx={{ color: '#1E40AF' }}>
                    Replying to {replyTo.authorName}
                  </Typography>
                  <Button size="small" onClick={() => setReplyTo(null)}>
                    Cancel
                  </Button>
                </Stack>
              )}
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small"
                  fullWidth
                  multiline
                  maxRows={4}
                  placeholder={replyTo ? 'Write a reply...' : 'Add an operational update or comment...'}
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                />
                <Button
                  type="submit"
                  variant="contained"
                  disabled={postingComment || !commentBody.trim()}
                  endIcon={<SendOutlinedIcon fontSize="small" />}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Post
                </Button>
              </Stack>
            </Box>

            {topComments.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No comments yet. Post an update to coordinate with your team.
              </Typography>
            ) : (
              <Stack spacing={2}>
                {topComments.map((c) => {
                  const replies = repliesByParent.get(c.id) ?? [];
                  return (
                    <Box
                      key={c.id}
                      sx={{
                        pb: 2,
                        borderBottom: '1px solid #F1F5F9',
                      }}
                    >
                      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F172A' }}>
                          {c.authorName}{' '}
                          <Typography component="span" variant="caption" sx={{ color: '#64748B', fontWeight: 400 }}>
                            · {c.authorRole}
                          </Typography>
                        </Typography>
                        <Typography variant="caption" className="font-mono-num" sx={{ color: '#64748B' }}>
                          {formatTimestamp(c.createdAt)}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ color: '#334155', mt: 0.75, whiteSpace: 'pre-wrap' }}>
                        {c.body}
                      </Typography>
                      <Button
                        size="small"
                        startIcon={<ReplyOutlinedIcon sx={{ fontSize: 15 }} />}
                        onClick={() => setReplyTo(c)}
                        sx={{ mt: 0.5, px: 0.75, minHeight: 28, color: '#475569' }}
                      >
                        Reply
                      </Button>

                      {replies.length > 0 && (
                        <Stack spacing={1.25} sx={{ mt: 1.5, pl: 2.5, borderLeft: '1px solid #E2E8F0' }}>
                          {replies.map((r) => (
                            <Box key={r.id}>
                              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: '#0F172A' }}>
                                  {r.authorName} · {r.authorRole}
                                </Typography>
                                <Typography variant="caption" className="font-mono-num" sx={{ color: '#64748B' }}>
                                  {formatTimestamp(r.createdAt)}
                                </Typography>
                              </Stack>
                              <Typography variant="body2" sx={{ color: '#334155', mt: 0.25 }}>
                                {r.body}
                              </Typography>
                            </Box>
                          ))}
                        </Stack>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>
        )}

        {/* Attachments Tab */}
        {!loadingSub && tab === 'attachments' && (
          <Box>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={handleFilesSelected}
            />

            <Box
              sx={{
                p: 2.5,
                mb: 2.5,
                border: '1px dashed #CBD5E1',
                borderRadius: 1.5,
                bgcolor: '#F8FAFC',
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                gap: 2,
              }}
            >
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A' }}>
                  Attach Operational Files
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Supports PDF, Images (PNG, JPG, WEBP), and Excel (.xlsx, .xls, .csv) up to 15 MB.
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={<UploadFileOutlinedIcon fontSize="small" />}
                disabled={uploadingFile}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingFile ? 'Uploading...' : 'Upload Files'}
              </Button>
            </Box>

            {attachments.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No files attached to this task yet.
              </Typography>
            ) : (
              <Stack divider={<Divider />} spacing={1}>
                {attachments.map((att) => {
                  const canRemoveAtt =
                    user?.role === 'Admin' ||
                    user?.role === 'Supervisor' ||
                    att.uploadedBy === user?.id;
                  return (
                    <Stack
                      key={att.id}
                      direction="row"
                      spacing={1.5}
                      sx={{ alignItems: 'center', justifyContent: 'space-between', py: 1 }}
                    >
                      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
                        <AttachFileIcon sx={{ fontSize: 18, color: '#64748B', flexShrink: 0 }} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                            {att.fileName}
                          </Typography>
                          <Typography variant="caption" className="font-mono-num" color="text.secondary">
                            {formatBytes(att.fileSize)} · {att.uploadedByName} · {formatTimestamp(att.createdAt)}
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                        <IconButton
                          aria-label={`Download ${att.fileName}`}
                          size="small"
                          onClick={() => handleDownload(att)}
                        >
                          <DownloadOutlinedIcon fontSize="small" />
                        </IconButton>
                        {canRemoveAtt && (
                          <IconButton
                            aria-label={`Delete ${att.fileName}`}
                            size="small"
                            color="error"
                            onClick={() => handleDeleteAttachment(att)}
                          >
                            <DeleteOutlinedIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Stack>
                    </Stack>
                  );
                })}
              </Stack>
            )}
          </Box>
        )}

        {/* Activity History Tab */}
        {!loadingSub && tab === 'activity' && (
          <Stack spacing={1.75}>
            {activities.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No activity recorded.
              </Typography>
            ) : (
              activities.map((act) => (
                <Box
                  key={act.id}
                  sx={{
                    pb: 1.5,
                    borderBottom: '1px solid #F1F5F9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 2,
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A' }}>
                      {act.action}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      By {act.actorName}
                      {act.details && Object.keys(act.details).length > 0
                        ? ` · ${Object.entries(act.details)
                            .map(([k, v]) => `${k}: ${String(v)}`)
                            .join(', ')}`
                        : ''}
                    </Typography>
                  </Box>
                  <Typography variant="caption" className="font-mono-num" sx={{ color: '#64748B', flexShrink: 0 }}>
                    {formatTimestamp(act.createdAt)}
                  </Typography>
                </Box>
              ))
            )}
          </Stack>
        )}
      </Box>
    </Drawer>
  );
}
