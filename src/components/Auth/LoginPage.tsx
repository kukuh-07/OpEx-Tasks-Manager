import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import SupervisorAccountOutlinedIcon from '@mui/icons-material/SupervisorAccountOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { DEPARTMENTS, type UserRole } from '../../types';

export function LoginPage() {
  const { login, register, demoLogin } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [jobTitle, setJobTitle] = useState('Operations Specialist');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        const res = await register({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          department,
          jobTitle: jobTitle.trim() || 'Operations Specialist',
        });
        if (res.confirmationPending) {
          setMode('login');
          setNotice(
            'Account created. Check your inbox to confirm your email address, then sign in.'
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemo = async (role: UserRole) => {
    setError(null);
    setSubmitting(true);
    try {
      await demoLogin(role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sample login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1.05fr 1fr' },
      }}
    >
      {/* Left Operational Context Column */}
      <Box
        sx={{
          bgcolor: '#0F172A',
          color: '#F8FAFC',
          p: { xs: 4, md: 7 },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderRight: { md: '1px solid #1E293B' },
        }}
      >
        <Box>
          <Typography
            variant="h6"
            sx={{ color: '#FFFFFF', fontWeight: 700, letterSpacing: '-0.02em' }}
          >
            OpEx Task Manager
          </Typography>
          <Typography variant="body2" sx={{ color: '#94A3B8', mt: 0.5 }}>
            Collaborative Operational Excellence Platform
          </Typography>
        </Box>

        <Box sx={{ my: { xs: 5, md: 0 }, maxWidth: 460 }}>
          <Typography
            variant="h3"
            sx={{
              color: '#FFFFFF',
              fontSize: { xs: '1.75rem', md: '2.25rem' },
              lineHeight: 1.2,
              textWrap: 'balance',
            }}
          >
            Coordinate plant execution, compliance audits, and team accountability.
          </Typography>
          <Typography variant="body1" sx={{ color: '#CBD5E1', mt: 2.5, lineHeight: 1.6 }}>
            Assign operational work with clear deadlines, attach PDF inspection packets and Excel
            sheets, track threaded team discussions, and monitor completion metrics across shifts.
          </Typography>

          <Stack
            spacing={2}
            sx={{ mt: 4, pt: 4, borderTop: '1px solid rgba(148, 163, 184, 0.2)' }}
          >
            <Box>
              <Typography variant="subtitle2" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                Role-Based Access Control
              </Typography>
              <Typography variant="body2" sx={{ color: '#94A3B8', mt: 0.25 }}>
                Admin, Supervisor, and Member permissions tailored for operational governance.
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                Full Audit & Reporting
              </Typography>
              <Typography variant="body2" sx={{ color: '#94A3B8', mt: 0.25 }}>
                Activity history on every task, overdue escalation, and instant CSV export.
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Typography variant="caption" sx={{ color: '#64748B' }}>
          OpEx Task Manager · Built for high-reliability operations teams
        </Typography>
      </Box>

      {/* Right Authentication Form Column */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 3, sm: 5 },
        }}
      >
        <Paper
          sx={{
            width: '100%',
            maxWidth: 440,
            p: { xs: 3, sm: 4 },
            bgcolor: 'background.paper',
          }}
        >
          <Typography variant="h5" sx={{ color: 'text.primary', mb: 0.5 }}>
            {mode === 'login' ? 'Sign in to workspace' : 'Create operational account'}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
            {mode === 'login'
              ? 'Enter your team email and password to access tasks and reports.'
              : 'Register a Member account to collaborate with your team.'}
          </Typography>

          <Tabs
            value={mode}
            onChange={(_, val) => {
              setMode(val);
              setError(null);
              setNotice(null);
            }}
            sx={{ mb: 3, borderBottom: '1px solid #E2E8F0' }}
          >
            <Tab label="Sign In" value="login" />
            <Tab label="Register" value="register" />
          </Tabs>

          {notice && (
            <Alert severity="success" sx={{ mb: 2.5 }}>
              {notice}
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2.5 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2}>
              {mode === 'register' && (
                <>
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
                      {DEPARTMENTS.map((dept) => (
                        <MenuItem key={dept} value={dept}>
                          {dept}
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
                </>
              )}

              <TextField
                label="Work Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
                size="small"
                placeholder="name@company.com"
              />
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
                size="small"
                helperText={mode === 'register' ? 'Minimum 8 characters' : undefined}
              />

              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={submitting}
                fullWidth
              >
                {submitting
                  ? 'Authenticating...'
                  : mode === 'login'
                    ? 'Sign In'
                    : 'Create Account'}
              </Button>
            </Stack>
          </Box>

          {!isSupabaseConfigured && (
            <>
              <Divider sx={{ my: 3 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Or preview with sample role
                </Typography>
              </Divider>

              <Stack spacing={1}>
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={() => handleDemo('Admin')}
                  disabled={submitting}
                  startIcon={<AdminPanelSettingsOutlinedIcon fontSize="small" />}
                  sx={{ justifyContent: 'flex-start', borderColor: '#CBD5E1', color: '#0F172A' }}
                >
                  Elena Vance · Admin (Full Control)
                </Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={() => handleDemo('Supervisor')}
                  disabled={submitting}
                  startIcon={<SupervisorAccountOutlinedIcon fontSize="small" />}
                  sx={{ justifyContent: 'flex-start', borderColor: '#CBD5E1', color: '#0F172A' }}
                >
                  Marcus Chen · Supervisor (Assign & Review)
                </Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={() => handleDemo('Member')}
                  disabled={submitting}
                  startIcon={<PersonOutlinedIcon fontSize="small" />}
                  sx={{ justifyContent: 'flex-start', borderColor: '#CBD5E1', color: '#0F172A' }}
                >
                  Priya Nair · Member (Task Execution)
                </Button>
              </Stack>
            </>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
