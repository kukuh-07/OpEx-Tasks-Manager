import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import type { AppNotification, NotificationType } from '../../types';
import { formatTimestamp } from '../Tasks/TaskStatusMark';

interface NotificationsPageProps {
  notifications: AppNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onOpenTaskById: (taskId: string) => void;
}

const TYPE_LABEL: Record<NotificationType, string> = {
  task_assigned: 'Task Assigned',
  task_updated: 'Task Updated',
  task_completed: 'Task Completed',
  comment_added: 'Comment Added',
  due_soon: 'Due Soon Alert',
  overdue_alert: 'Overdue Alert',
};

const TYPE_COLOR: Record<NotificationType, string> = {
  task_assigned: '#1D4ED8',
  task_updated: '#0369A1',
  task_completed: '#16A34A',
  comment_added: '#475569',
  due_soon: '#D97706',
  overdue_alert: '#DC2626',
};

export function NotificationsPage({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onOpenTaskById,
}: NotificationsPageProps) {
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' } }}
      >
        <Box>
          <Typography variant="h4" sx={{ color: '#0F172A' }}>
            Notifications
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {unreadCount} unread operational alerts across assignments, due-soon reminders, and overdue escalations.
          </Typography>
        </Box>

        {unreadCount > 0 && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<DoneAllIcon fontSize="small" />}
            onClick={onMarkAllRead}
          >
            Mark All Read
          </Button>
        )}
      </Stack>

      <Paper sx={{ overflow: 'hidden' }}>
        {notifications.length === 0 ? (
          <Box sx={{ p: 5, textAlign: 'center' }}>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              No notifications yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Alerts appear here when tasks are assigned, approaching due dates, overdue, or completed.
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {notifications.map((n, index) => (
              <Box key={n.id}>
                {index > 0 && <Divider />}
                <ListItemButton
                  onClick={() => {
                    if (!n.isRead) onMarkRead(n.id);
                    if (n.taskId) onOpenTaskById(n.taskId);
                  }}
                  sx={{
                    py: 2,
                    px: 2.5,
                    bgcolor: n.isRead ? '#FFFFFF' : '#EFF6FF',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 2,
                  }}
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                      <Typography variant="caption" sx={{ color: TYPE_COLOR[n.type], fontWeight: 700 }}>
                        {TYPE_LABEL[n.type]}
                      </Typography>
                      <span aria-hidden="true" style={{ color: '#CBD5E1' }}>·</span>
                      <Typography variant="caption" className="font-mono-num" sx={{ color: '#64748B' }}>
                        {formatTimestamp(n.createdAt)}
                      </Typography>
                      {!n.isRead && (
                        <>
                          <span aria-hidden="true" style={{ color: '#CBD5E1' }}>·</span>
                          <Typography variant="caption" sx={{ color: '#DC2626', fontWeight: 700 }}>
                            Unread
                          </Typography>
                        </>
                      )}
                    </Stack>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F172A', mt: 0.5 }}>
                      {n.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                      {n.message}
                    </Typography>
                  </Box>
                </ListItemButton>
              </Box>
            ))}
          </List>
        )}
      </Paper>
    </Stack>
  );
}
