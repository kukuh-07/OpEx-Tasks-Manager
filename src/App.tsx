import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import CssBaseline from '@mui/material/CssBaseline';
import Snackbar from '@mui/material/Snackbar';
import { ThemeProvider } from '@mui/material/styles';
import { LoginPage } from './components/Auth/LoginPage';
import { DashboardPage } from './components/Dashboard/DashboardPage';
import { AppShell, type NavSection } from './components/Layout/AppShell';
import { NotificationsPage } from './components/Notifications/NotificationsPage';
import { ProfilePage } from './components/Profile/ProfilePage';
import { ReportsPage } from './components/Reports/ReportsPage';
import { ExcelImportDialog } from './components/Tasks/ExcelImportDialog';
import { TaskDetailDrawer } from './components/Tasks/TaskDetailDrawer';
import { TaskFormDialog } from './components/Tasks/TaskFormDialog';
import { TasksPage, type TaskStatusFilterValue } from './components/Tasks/TasksPage';
import { UsersPage } from './components/Users/UsersPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { notificationService } from './services/notificationService';
import { taskService } from './services/taskService';
import { userService } from './services/userService';
import { muiTheme } from './theme/muiTheme';
import type {
  AppNotification,
  CreateTaskInput,
  Task,
  UpdateTaskInput,
  UserProfile,
} from './types';

function WorkspaceApp() {
  const { user, loading } = useAuth();
  const [section, setSection] = useState<NavSection>('dashboard');
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilterValue>('All');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [dashboardImportOpen, setDashboardImportOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const refreshAll = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    try {
      const [taskList, userList, notifList] = await Promise.all([
        taskService.list(),
        userService.list(),
        notificationService.list(),
      ]);
      setTasks(taskList);
      setUsers(userList);
      setNotifications(notifList);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to load workspace data.',
        severity: 'error',
      });
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      refreshAll();
    } else {
      setTasks([]);
      setUsers([]);
      setNotifications([]);
      setSelectedTaskId(null);
    }
  }, [user, refreshAll]);

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  const handleSaveTask = async (payload: CreateTaskInput) => {
    if (editingTask) {
      const updated = await taskService.update(editingTask.id, payload);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setToast({ message: `${updated.taskCode} updated.`, severity: 'success' });
    } else {
      const created = await taskService.create(payload);
      setTasks((prev) => [created, ...prev]);
      setToast({ message: `${created.taskCode} created.`, severity: 'success' });
    }
    setEditingTask(null);
    const notifList = await notificationService.list();
    setNotifications(notifList);
  };

  const handleImportTasks = async (rows: CreateTaskInput[]) => {
    const res = await taskService.importBatch(rows);
    setTasks((prev) => [...res.tasks, ...prev]);
    const notifList = await notificationService.list();
    setNotifications(notifList);
    setToast({
      message: `Imported ${res.importedCount} task${res.importedCount === 1 ? '' : 's'} from Excel.`,
      severity: 'success',
    });
  };

  const handleUpdateTask = async (id: string, updates: UpdateTaskInput) => {
    const updated = await taskService.update(id, updates);
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    const notifList = await notificationService.list();
    setNotifications(notifList);
  };

  const handleDeleteTask = async (id: string) => {
    await taskService.remove(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (selectedTaskId === id) setSelectedTaskId(null);
    setToast({ message: 'Task deleted.', severity: 'success' });
  };

  const handleMarkRead = async (id: string) => {
    await notificationService.markRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const handleMarkAllRead = async () => {
    await notificationService.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleOpenTaskById = (taskId: string) => {
    const exists = tasks.some((t) => t.id === taskId);
    if (exists) {
      setSelectedTaskId(taskId);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <AppShell
      activeSection={section}
      onNavigate={setSection}
      onOpenNewTask={() => {
        setEditingTask(null);
        setFormOpen(true);
      }}
      notifications={notifications}
      onMarkNotificationRead={handleMarkRead}
      onMarkAllRead={handleMarkAllRead}
      onOpenTaskById={handleOpenTaskById}
    >
      {dataLoading && tasks.length === 0 ? (
        <Box sx={{ py: 10, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <>
          {section === 'dashboard' && (
            <DashboardPage
              tasks={tasks}
              users={users}
              onSelectTask={(t) => setSelectedTaskId(t.id)}
              onFilterTasks={(filter) => {
                setStatusFilter(filter ?? 'All');
                setSection('tasks');
              }}
              onOpenImport={() => setDashboardImportOpen(true)}
            />
          )}

          {section === 'tasks' && (
            <TasksPage
              tasks={tasks}
              users={users}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              onSelectTask={(t) => setSelectedTaskId(t.id)}
              onEditTask={(t) => {
                setEditingTask(t);
                setFormOpen(true);
              }}
              onDeleteTask={handleDeleteTask}
              onCreateNew={() => {
                setEditingTask(null);
                setFormOpen(true);
              }}
              onImportTasks={handleImportTasks}
            />
          )}

          {section === 'reports' && (
            <ReportsPage
              tasks={tasks}
              users={users}
              onSelectTask={(t) => setSelectedTaskId(t.id)}
            />
          )}

          {section === 'users' && (
            <UsersPage users={users} onUsersChanged={refreshAll} />
          )}

          {section === 'notifications' && (
            <NotificationsPage
              notifications={notifications}
              onMarkRead={handleMarkRead}
              onMarkAllRead={handleMarkAllRead}
              onOpenTaskById={handleOpenTaskById}
            />
          )}

          {section === 'profile' && <ProfilePage />}
        </>
      )}

      <TaskFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
        users={users}
        initialTask={editingTask}
      />

      <ExcelImportDialog
        open={dashboardImportOpen}
        onClose={() => setDashboardImportOpen(false)}
        users={users}
        onImportConfirm={handleImportTasks}
      />

      <TaskDetailDrawer
        task={selectedTask}
        open={Boolean(selectedTask)}
        onClose={() => setSelectedTaskId(null)}
        users={users}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        onOpenEditModal={(t) => {
          setEditingTask(t);
          setFormOpen(true);
        }}
      />

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {toast ? (
          <Alert severity={toast.severity} onClose={() => setToast(null)}>
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </AppShell>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <AuthProvider>
        <WorkspaceApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
