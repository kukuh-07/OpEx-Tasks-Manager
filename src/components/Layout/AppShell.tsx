import React, { useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import { useAuth } from '../../context/AuthContext';
import type { AppNotification } from '../../types';
import { formatTimestamp } from '../Tasks/TaskStatusMark';

export type NavSection =
  | 'dashboard'
  | 'tasks'
  | 'reports'
  | 'users'
  | 'notifications'
  | 'profile';

const DRAWER_WIDTH = 252;

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardOutlinedIcon fontSize="small" /> },
  { id: 'tasks', label: 'Tasks', icon: <AssignmentOutlinedIcon fontSize="small" /> },
  { id: 'reports', label: 'Reports', icon: <AssessmentOutlinedIcon fontSize="small" /> },
  { id: 'users', label: 'Team & Users', icon: <GroupOutlinedIcon fontSize="small" /> },
  { id: 'notifications', label: 'Notifications', icon: <NotificationsNoneOutlinedIcon fontSize="small" /> },
  { id: 'profile', label: 'Profile', icon: <PersonOutlinedIcon fontSize="small" /> },
];

interface AppShellProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
  onOpenNewTask: () => void;
  notifications: AppNotification[];
  onMarkNotificationRead: (id: string) => void;
  onMarkAllRead: () => void;
  onOpenTaskById: (taskId: string) => void;
  children: React.ReactNode;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function AppShell({
  activeSection,
  onNavigate,
  onOpenNewTask,
  notifications,
  onMarkNotificationRead,
  onMarkAllRead,
  onOpenTaskById,
  children,
}: AppShellProps) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifAnchor, setNotifAnchor] = useState<HTMLElement | null>(null);
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const activeLabel = NAV_ITEMS.find((i) => i.id === activeSection)?.label ?? 'Dashboard';

  const sidebarContent = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#FFFFFF',
      }}
    >
      <Box sx={{ px: 2.5, py: 2.25, borderBottom: '1px solid #E2E8F0' }}>
        <Typography
          variant="h6"
          sx={{ fontWeight: 700, color: '#0F172A', fontSize: '1.0625rem', whiteSpace: 'nowrap' }}
        >
          OpEx Task Manager
        </Typography>
      </Box>

      <List sx={{ px: 1.5, py: 2, flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const selected = activeSection === item.id;
          return (
            <ListItemButton
              key={item.id}
              selected={selected}
              onClick={() => {
                onNavigate(item.id);
                setMobileOpen(false);
              }}
              sx={{
                borderRadius: 1.5,
                mb: 0.5,
                minHeight: 42,
                color: selected ? '#1D4ED8' : '#475569',
                bgcolor: selected ? '#EFF6FF' : 'transparent',
                '&.Mui-selected': {
                  bgcolor: '#EFF6FF',
                  color: '#1D4ED8',
                  '&:hover': { bgcolor: '#DBEAFE' },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 34,
                  color: selected ? '#1D4ED8' : '#64748B',
                }}
              >
                {item.id === 'notifications' && unreadCount > 0 ? (
                  <Badge badgeContent={unreadCount} color="error" max={99}>
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                slotProps={{
                  primary: {
                    noWrap: true,
                    sx: {
                      fontSize: '0.875rem',
                      fontWeight: selected ? 600 : 500,
                    },
                  },
                }}
              />
            </ListItemButton>
          );
        })}
      </List>

      {user && (
        <Box sx={{ p: 2, borderTop: '1px solid #E2E8F0' }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Avatar
              sx={{
                width: 34,
                height: 34,
                bgcolor: '#EFF6FF',
                color: '#1D4ED8',
                fontSize: '0.8125rem',
                fontWeight: 700,
              }}
            >
              {getInitials(user.fullName)}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A' }} noWrap>
                {user.fullName}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }} noWrap>
                {user.role} · {user.department}
              </Typography>
            </Box>
          </Stack>
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Desktop Sidebar */}
      <Box
        component="nav"
        sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, borderRight: '1px solid #E2E8F0' },
          }}
        >
          {sidebarContent}
        </Drawer>

        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              borderRight: '1px solid #E2E8F0',
              borderTop: 'none',
              borderBottom: 'none',
              borderLeft: 'none',
            },
          }}
        >
          {sidebarContent}
        </Drawer>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{
            bgcolor: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
          }}
        >
          <Toolbar
            sx={{
              minHeight: { xs: 58, sm: 64 },
              px: { xs: 2, sm: 3 },
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            {/* Left Zone: Mobile toggle + Breadcrumb */}
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
              <IconButton
                aria-label="Open navigation menu"
                onClick={() => setMobileOpen(true)}
                sx={{ display: { md: 'none' }, minWidth: 44, minHeight: 44 }}
              >
                <MenuIcon />
              </IconButton>
              <Typography
                variant="body2"
                sx={{ color: '#64748B', display: { xs: 'none', sm: 'inline' }, whiteSpace: 'nowrap' }}
              >
                OpEx
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: '#CBD5E1', display: { xs: 'none', sm: 'inline' } }}
              >
                /
              </Typography>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}
              >
                {activeLabel}
              </Typography>
            </Stack>

            {/* Right Zone: Primary Action + Notifications + Profile */}
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', flexShrink: 0 }}>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={onOpenNewTask}
              >
                New Task
              </Button>

              <IconButton
                aria-label="Open notifications"
                onClick={(e) => setNotifAnchor(e.currentTarget)}
                sx={{
                  border: '1px solid #E2E8F0',
                  borderRadius: 1.5,
                  width: 38,
                  height: 38,
                }}
              >
                <Badge badgeContent={unreadCount} color="error" max={99}>
                  <NotificationsNoneOutlinedIcon fontSize="small" />
                </Badge>
              </IconButton>

              <IconButton
                aria-label="Account menu"
                onClick={(e) => setProfileAnchor(e.currentTarget)}
                sx={{ p: 0.25 }}
              >
                <Avatar
                  sx={{
                    width: 34,
                    height: 34,
                    bgcolor: '#0F172A',
                    color: '#FFFFFF',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                  }}
                >
                  {user ? getInitials(user.fullName) : 'OP'}
                </Avatar>
              </IconButton>
            </Stack>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ flex: 1, p: { xs: 2, sm: 3, lg: 4 }, maxWidth: 1440, width: '100%', mx: 'auto' }}>
          {children}
        </Box>
      </Box>

      {/* Notifications Popover */}
      <Popover
        open={Boolean(notifAnchor)}
        anchorEl={notifAnchor}
        onClose={() => setNotifAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: { width: { xs: 320, sm: 380 }, maxHeight: 440, mt: 1 },
          },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Notifications
          </Typography>
          <Stack direction="row" spacing={1}>
            {unreadCount > 0 && (
              <Button size="small" onClick={onMarkAllRead}>
                Mark all read
              </Button>
            )}
            <Button
              size="small"
              onClick={() => {
                setNotifAnchor(null);
                onNavigate('notifications');
              }}
            >
              View all
            </Button>
          </Stack>
        </Box>
        {notifications.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No notifications yet.
            </Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ maxHeight: 350, overflowY: 'auto' }}>
            {notifications.slice(0, 8).map((n) => (
              <ListItemButton
                key={n.id}
                onClick={() => {
                  if (!n.isRead) onMarkNotificationRead(n.id);
                  setNotifAnchor(null);
                  if (n.taskId) onOpenTaskById(n.taskId);
                }}
                sx={{
                  alignItems: 'flex-start',
                  bgcolor: n.isRead ? '#FFFFFF' : '#EFF6FF',
                  borderBottom: '1px solid #F1F5F9',
                  py: 1.5,
                }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: n.isRead ? 500 : 700, color: '#0F172A' }} noWrap>
                      {n.title}
                    </Typography>
                    <Typography variant="caption" className="font-mono-num" sx={{ color: '#64748B', flexShrink: 0 }}>
                      {formatTimestamp(n.createdAt)}
                    </Typography>
                  </Stack>
                  <Typography variant="caption" sx={{ color: '#475569', display: 'block', mt: 0.25 }}>
                    {n.message}
                  </Typography>
                </Box>
              </ListItemButton>
            ))}
          </List>
        )}
      </Popover>

      {/* Account Menu */}
      <Menu
        anchorEl={profileAnchor}
        open={Boolean(profileAnchor)}
        onClose={() => setProfileAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {user && (
          <Box sx={{ px: 2, py: 1.25 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {user.fullName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {user.email} · {user.role}
            </Typography>
          </Box>
        )}
        <Divider />
        <MenuItem
          onClick={() => {
            setProfileAnchor(null);
            onNavigate('profile');
          }}
        >
          <ListItemIcon>
            <PersonOutlinedIcon fontSize="small" />
          </ListItemIcon>
          Profile & Security
        </MenuItem>
        <MenuItem
          onClick={() => {
            setProfileAnchor(null);
            logout();
          }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Sign Out
        </MenuItem>
      </Menu>
    </Box>
  );
}
