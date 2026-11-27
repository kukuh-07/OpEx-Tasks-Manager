import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { AREAS, BRANCHES, DEPARTMENTS, OUTLETS } from '../../types';

export function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [department, setDepartment] = useState(user?.department ?? DEPARTMENTS[0]);
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? '');
  const [area, setArea] = useState(user?.area ?? AREAS[0]);
  const [branch, setBranch] = useState(user?.branch ?? BRANCHES[0]);
  const [outlet, setOutlet] = useState(user?.outlet ?? OUTLETS[0]);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setSaving(true);
    try {
      await authService.updateProfile({
        fullName: fullName.trim(),
        department,
        jobTitle: jobTitle.trim(),
        area,
        branch,
        outlet,
        newPassword: newPassword || undefined,
      });
      await refreshProfile();
      setNewPassword('');
      setMessage('Profile updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={3} sx={{ maxWidth: 860 }}>
      <Box>
        <Typography variant="h4" sx={{ color: '#0F172A' }}>
          User Profile
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          Manage your operational identity, Area/Branch/Outlet assignment, and role permissions.
        </Typography>
      </Box>

      {message && <Alert severity="success">{message}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}

      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
          Account Details
        </Typography>

        <Box component="form" onSubmit={handleSave}>
          <Stack spacing={2.25}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Email Address"
                value={user.email}
                disabled
                fullWidth
                size="small"
              />
              <TextField
                label="Assigned Role"
                value={user.role}
                disabled
                fullWidth
                size="small"
              />
            </Stack>

            <TextField
              label="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              fullWidth
              size="small"
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
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
              <TextField
                label="Job Title"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                fullWidth
                size="small"
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                label="Assigned Area"
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
                label="Assigned Branch"
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
                label="Assigned Outlet"
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

            <Divider sx={{ my: 1 }} />

            <TextField
              label="New Password (Optional)"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              fullWidth
              size="small"
              helperText="Leave blank to keep your current password. Minimum 8 characters."
            />

            <Box>
              <Button type="submit" variant="contained" disabled={saving}>
                {saving ? 'Saving...' : 'Save Profile'}
              </Button>
            </Box>
          </Stack>
        </Box>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
          Role-Based Access Control ({user.role})
        </Typography>
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            · Create tasks, import/export Excel sheets, upload attachments, and post comments:{' '}
            <strong style={{ color: '#16A34A' }}>Allowed</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            · Reassign tasks across team members:{' '}
            <strong style={{ color: user.role === 'Member' ? '#DC2626' : '#16A34A' }}>
              {user.role === 'Member' ? 'Restricted (Admin / Supervisor)' : 'Allowed'}
            </strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            · Delete any operational task & manage user roles/status:{' '}
            <strong style={{ color: user.role === 'Admin' ? '#16A34A' : '#DC2626' }}>
              {user.role === 'Admin' ? 'Allowed' : 'Restricted (Admin only)'}
            </strong>
          </Typography>
        </Stack>
      </Paper>
    </Stack>
  );
}
