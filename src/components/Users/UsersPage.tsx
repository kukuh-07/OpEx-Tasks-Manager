import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
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
import Typography from '@mui/material/Typography';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { userService } from '../../services/userService';
import {
  AREAS,
  BRANCHES,
  canUserManageUsers,
  DEPARTMENTS,
  OUTLETS,
  USER_ROLES,
  USER_STATUSES,
  type UserProfile,
  type UserRole,
  type UserStatus,
} from '../../types';

interface UsersPageProps {
  users: UserProfile[];
  onUsersChanged: () => Promise<void>;
}

export function UsersPage({ users, onUsersChanged }: UsersPageProps) {
  const { user } = useAuth();
  const isAdmin = canUserManageUsers(user);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'All'>('All');
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('Member');
  const [newDept, setNewDept] = useState(DEPARTMENTS[0]);
  const [newTitle, setNewTitle] = useState('Operations Specialist');
  const [newArea, setNewArea] = useState(AREAS[0]);
  const [newBranch, setNewBranch] = useState(BRANCHES[0]);
  const [newOutlet, setNewOutlet] = useState(OUTLETS[0]);
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);

  const activeCount = users.filter((u) => u.status === 'Active').length;
  const adminCount = users.filter((u) => u.role === 'Admin').length;
  const supervisorCount = users.filter((u) => u.role === 'Supervisor').length;

  const filtered = users.filter((u) => {
    if (roleFilter !== 'All' && u.role !== roleFilter) return false;
    if (statusFilter !== 'All' && u.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (
        !`${u.fullName} ${u.email} ${u.department} ${u.jobTitle} ${u.area} ${u.branch} ${u.outlet}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const handleUpdateUser = async (
    targetId: string,
    updates: Partial<
      Pick<UserProfile, 'role' | 'status' | 'area' | 'branch' | 'outlet'>
    >
  ) => {
    setError(null);
    setUpdatingId(targetId);
    try {
      await userService.update(targetId, updates);
      await onUsersChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await userService.create({
        email: newEmail.trim(),
        fullName: newName.trim(),
        role: newRole,
        department: newDept,
        jobTitle: newTitle.trim() || 'Operations Specialist',
        area: newArea,
        branch: newBranch,
        outlet: newOutlet,
        password: newPassword || undefined,
      });
      setAddOpen(false);
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      await onUsersChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to provision user.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' } }}
      >
        <Box>
          <Typography variant="h4" sx={{ color: '#0F172A' }}>
            Team & User Management
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Active team members, operational roles, Area/Branch/Outlet assignments, and status governance.
          </Typography>
        </Box>

        {isAdmin && !isSupabaseConfigured && (
          <Button
            variant="contained"
            startIcon={<PersonAddOutlinedIcon fontSize="small" />}
            onClick={() => setAddOpen(true)}
          >
            Add Team Member
          </Button>
        )}
      </Stack>

      {!isAdmin && (
        <Alert severity="info">
          You are viewing the team directory with {user?.role} permissions. Only Admins can modify
          user roles, location assignments, or account statuses.
        </Alert>
      )}

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Summary Strip */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 2,
        }}
      >
        <Paper sx={{ p: 2.25 }}>
          <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
            Total Users
          </Typography>
          <Typography variant="h4" className="font-mono-num" sx={{ mt: 0.5 }}>
            {users.length}
          </Typography>
        </Paper>
        <Paper sx={{ p: 2.25 }}>
          <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
            Active Users
          </Typography>
          <Typography variant="h4" className="font-mono-num" sx={{ mt: 0.5, color: '#16A34A' }}>
            {activeCount}
          </Typography>
        </Paper>
        <Paper sx={{ p: 2.25 }}>
          <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
            Admins
          </Typography>
          <Typography variant="h4" className="font-mono-num" sx={{ mt: 0.5, color: '#1D4ED8' }}>
            {adminCount}
          </Typography>
        </Paper>
        <Paper sx={{ p: 2.25 }}>
          <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
            Supervisors
          </Typography>
          <Typography variant="h4" className="font-mono-num" sx={{ mt: 0.5, color: '#0F172A' }}>
            {supervisorCount}
          </Typography>
        </Paper>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
          <TextField
            size="small"
            fullWidth
            placeholder="Search by name, email, department, area, branch, or outlet..."
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
            label="Role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as UserRole | 'All')}
            sx={{ minWidth: { md: 160 } }}
          >
            <MenuItem value="All">All Roles</MenuItem>
            {USER_ROLES.map((r) => (
              <MenuItem key={r} value={r}>
                {r}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as UserStatus | 'All')}
            sx={{ minWidth: { md: 160 } }}
          >
            <MenuItem value="All">All Statuses</MenuItem>
            {USER_STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Paper>

      {/* Users Table */}
      <Paper sx={{ overflow: 'hidden' }}>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Member</TableCell>
                <TableCell>Department & Title</TableCell>
                <TableCell>Area Assignment</TableCell>
                <TableCell>Branch / Outlet Assignment</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((u) => {
                const isSelf = u.id === user?.id;
                const statusColor =
                  u.status === 'Active'
                    ? '#16A34A'
                    : u.status === 'Inactive'
                      ? '#64748B'
                      : '#DC2626';
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A' }}>
                        {u.fullName} {isSelf ? '(You)' : ''}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {u.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: '#334155' }}>
                        {u.department}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {u.jobTitle}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <TextField
                          select
                          size="small"
                          value={u.area}
                          disabled={updatingId === u.id}
                          onChange={(e) => handleUpdateUser(u.id, { area: e.target.value })}
                          sx={{ minWidth: 140 }}
                        >
                          {Array.from(new Set([u.area, ...AREAS])).map((a) => (
                            <MenuItem key={a} value={a}>
                              {a}
                            </MenuItem>
                          ))}
                        </TextField>
                      ) : (
                        <Typography variant="body2" sx={{ color: '#334155' }}>
                          {u.area}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                          <TextField
                            select
                            size="small"
                            value={u.branch}
                            disabled={updatingId === u.id}
                            onChange={(e) => handleUpdateUser(u.id, { branch: e.target.value })}
                            sx={{ minWidth: 165 }}
                          >
                            {Array.from(new Set([u.branch, ...BRANCHES])).map((b) => (
                              <MenuItem key={b} value={b}>
                                {b}
                              </MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            select
                            size="small"
                            value={u.outlet}
                            disabled={updatingId === u.id}
                            onChange={(e) => handleUpdateUser(u.id, { outlet: e.target.value })}
                            sx={{ minWidth: 185 }}
                          >
                            {Array.from(new Set([u.outlet, ...OUTLETS])).map((o) => (
                              <MenuItem key={o} value={o}>
                                {o}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Stack>
                      ) : (
                        <Box>
                          <Typography variant="body2" sx={{ color: '#334155' }}>
                            {u.branch}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {u.outlet}
                          </Typography>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      {isAdmin && !isSelf ? (
                        <TextField
                          select
                          size="small"
                          value={u.role}
                          disabled={updatingId === u.id}
                          onChange={(e) =>
                            handleUpdateUser(u.id, { role: e.target.value as UserRole })
                          }
                          sx={{ minWidth: 125 }}
                        >
                          {USER_ROLES.map((r) => (
                            <MenuItem key={r} value={r}>
                              {r}
                            </MenuItem>
                          ))}
                        </TextField>
                      ) : (
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A' }}>
                          {u.role}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {isAdmin && !isSelf ? (
                        <TextField
                          select
                          size="small"
                          value={u.status}
                          disabled={updatingId === u.id}
                          onChange={(e) =>
                            handleUpdateUser(u.id, { status: e.target.value as UserStatus })
                          }
                          sx={{ minWidth: 125 }}
                        >
                          {USER_STATUSES.map((s) => (
                            <MenuItem key={s} value={s}>
                              {s}
                            </MenuItem>
                          ))}
                        </TextField>
                      ) : (
                        <Typography variant="body2" sx={{ fontWeight: 600, color: statusColor }}>
                          {u.status}
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      </Paper>

      {/* Add User Dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700, borderBottom: '1px solid #E2E8F0' }}>
          Add Team Member
        </DialogTitle>
        <form onSubmit={handleCreateUser}>
          <DialogContent sx={{ pt: 2.5 }}>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Full Name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Work Email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  fullWidth
                  size="small"
                />
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  select
                  label="Role"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  fullWidth
                  size="small"
                >
                  {USER_ROLES.map((r) => (
                    <MenuItem key={r} value={r}>
                      {r}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Department"
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                  fullWidth
                  size="small"
                >
                  {DEPARTMENTS.map((d) => (
                    <MenuItem key={d} value={d}>
                      {d}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  select
                  label="Area Assignment"
                  value={newArea}
                  onChange={(e) => setNewArea(e.target.value)}
                  fullWidth
                  size="small"
                >
                  {AREAS.map((a) => (
                    <MenuItem key={a} value={a}>
                      {a}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Branch Assignment"
                  value={newBranch}
                  onChange={(e) => setNewBranch(e.target.value)}
                  fullWidth
                  size="small"
                >
                  {BRANCHES.map((b) => (
                    <MenuItem key={b} value={b}>
                      {b}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  select
                  label="Outlet Assignment"
                  value={newOutlet}
                  onChange={(e) => setNewOutlet(e.target.value)}
                  fullWidth
                  size="small"
                >
                  {OUTLETS.map((o) => (
                    <MenuItem key={o} value={o}>
                      {o}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Job Title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  fullWidth
                  size="small"
                />
              </Stack>

              <TextField
                label="Initial Password (Optional, 8+ chars)"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                fullWidth
                size="small"
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #E2E8F0' }}>
            <Button onClick={() => setAddOpen(false)} color="inherit">
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={creating}>
              {creating ? 'Adding...' : 'Create User'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Stack>
  );
}
