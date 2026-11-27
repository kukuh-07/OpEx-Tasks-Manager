import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import { buildReportFromData, reportService } from '../../services/reportService';
import {
  formatTaskAge,
  getTaskAgeHours,
  getTaskSlaInfo,
  isTaskOverdue,
  type Task,
  type UserProfile,
} from '../../types';
import { TaskPriorityMark, TaskSlaMark } from '../Tasks/TaskStatusMark';

interface ReportsPageProps {
  tasks: Task[];
  users: UserProfile[];
  onSelectTask: (task: Task) => void;
}

export function ReportsPage({ tasks, users, onSelectTask }: ReportsPageProps) {
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [dimView, setDimView] = useState<'category' | 'area' | 'branch' | 'outlet'>('branch');
  const [error, setError] = useState<string | null>(null);

  const summary = buildReportFromData(tasks, users);
  const overdueList = tasks.filter((t) => isTaskOverdue(t));
  const maxMonthly = Math.max(
    1,
    ...summary.monthlySummary.map((m) => Math.max(m.created, m.completed))
  );

  const dimRows =
    dimView === 'category'
      ? summary.byCategory
      : dimView === 'area'
        ? summary.byArea
        : dimView === 'branch'
          ? summary.byBranch
          : summary.byOutlet;

  const handleExportCsv = async () => {
    setExportingCsv(true);
    setError(null);
    try {
      await reportService.exportCsv();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export CSV.');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportExcel = async () => {
    setExportingXlsx(true);
    setError(null);
    try {
      await reportService.exportExcel(tasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export Excel workbook.');
    } finally {
      setExportingXlsx(false);
    }
  };

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' } }}
      >
        <Box>
          <Typography variant="h4" sx={{ color: '#0F172A' }}>
            Operational Reports
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            SLA compliance, task aging, overdue exposure, location performance, and productivity exports.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.25}>
          <Button
            variant="outlined"
            startIcon={<DownloadOutlinedIcon fontSize="small" />}
            onClick={handleExportCsv}
            disabled={exportingCsv}
            sx={{ whiteSpace: 'nowrap' }}
          >
            {exportingCsv ? 'Exporting...' : 'Export CSV'}
          </Button>
          <Button
            variant="contained"
            startIcon={<DownloadOutlinedIcon fontSize="small" />}
            onClick={handleExportExcel}
            disabled={exportingXlsx}
            sx={{ whiteSpace: 'nowrap' }}
          >
            {exportingXlsx ? 'Exporting...' : 'Export Excel (.xlsx)'}
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      {/* Top Reporting KPIs */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
          gap: 2.5,
        }}
      >
        <Paper sx={{ p: 2.5 }}>
          <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
            Task Completion Rate
          </Typography>
          <Typography variant="h3" className="font-mono-num" sx={{ mt: 0.75, color: '#16A34A' }}>
            {summary.completionRate}%
          </Typography>
          <LinearProgress
            variant="determinate"
            value={summary.completionRate}
            sx={{
              mt: 1.5,
              height: 7,
              borderRadius: 4,
              bgcolor: '#F1F5F9',
              '& .MuiLinearProgress-bar': { bgcolor: '#16A34A' },
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {summary.completedTasks} completed of {summary.totalTasks - summary.cancelledTasks} active tasks
          </Typography>
        </Paper>

        <Paper sx={{ p: 2.5 }}>
          <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
            SLA Compliance Rate
          </Typography>
          <Typography variant="h3" className="font-mono-num" sx={{ mt: 0.75, color: '#1D4ED8' }}>
            {summary.slaComplianceRate}%
          </Typography>
          <LinearProgress
            variant="determinate"
            value={summary.slaComplianceRate}
            sx={{
              mt: 1.5,
              height: 7,
              borderRadius: 4,
              bgcolor: '#F1F5F9',
              '& .MuiLinearProgress-bar': { bgcolor: '#1D4ED8' },
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {summary.slaBreached} breached · {summary.slaAtRisk} at risk
          </Typography>
        </Paper>

        <Paper sx={{ p: 2.5 }}>
          <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
            Overdue & Due Soon
          </Typography>
          <Typography variant="h3" className="font-mono-num" sx={{ mt: 0.75, color: '#DC2626' }}>
            {summary.overdueTasks}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
            {overdueList.filter((t) => t.priority === 'Critical').length} Critical overdue ·{' '}
            {summary.dueSoonTasks} due within 48h
          </Typography>
        </Paper>

        <Paper sx={{ p: 2.5 }}>
          <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
            Average Open Task Age
          </Typography>
          <Typography variant="h3" className="font-mono-num" sx={{ mt: 0.75, color: '#0F172A' }}>
            {formatTaskAge(summary.avgAgeHours)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
            {summary.openTasks} Open · {summary.inProgressTasks} In Progress · {summary.reviewTasks} Review
          </Typography>
        </Paper>
      </Box>

      {/* Monthly Task Summary */}
      <Paper sx={{ p: 2.5 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Monthly Task Summary (Last 6 Months)
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Created vs Completed volume by calendar month
            </Typography>
          </Box>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: '#1D4ED8', fontWeight: 600 }}>
              Created
            </Typography>
            <Typography variant="caption" sx={{ color: '#16A34A', fontWeight: 600 }}>
              Completed
            </Typography>
          </Stack>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: 2,
            alignItems: 'end',
            minHeight: 170,
            pt: 2,
          }}
        >
          {summary.monthlySummary.map((m) => {
            const createdH = Math.max(6, Math.round((m.created / maxMonthly) * 120));
            const completedH = Math.max(6, Math.round((m.completed / maxMonthly) * 120));
            return (
              <Stack key={m.month} spacing={1} sx={{ alignItems: 'center' }}>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'flex-end', height: 125 }}>
                  <Box
                    title={`Created: ${m.created}`}
                    sx={{
                      width: { xs: 14, sm: 22 },
                      height: m.created === 0 ? 4 : createdH,
                      bgcolor: m.created === 0 ? '#E2E8F0' : '#1D4ED8',
                      borderRadius: '4px 4px 0 0',
                    }}
                  />
                  <Box
                    title={`Completed: ${m.completed}`}
                    sx={{
                      width: { xs: 14, sm: 22 },
                      height: m.completed === 0 ? 4 : completedH,
                      bgcolor: m.completed === 0 ? '#E2E8F0' : '#16A34A',
                      borderRadius: '4px 4px 0 0',
                    }}
                  />
                </Stack>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#334155', textAlign: 'center' }}>
                  {m.label}
                </Typography>
                <Typography variant="caption" className="font-mono-num" color="text.secondary">
                  {m.created} / {m.completed}
                </Typography>
              </Stack>
            );
          })}
        </Box>
      </Paper>

      {/* Category & Location Assignment Performance */}
      <Paper sx={{ overflow: 'hidden' }}>
        <Box
          sx={{
            px: 2.5,
            py: 2,
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1.5,
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Category & Location Assignment Breakdown
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ p: 0.35, bgcolor: '#F1F5F9', borderRadius: 1 }}>
            {(
              [
                ['category', 'Category'],
                ['area', 'Area'],
                ['branch', 'Branch'],
                ['outlet', 'Outlet'],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                size="small"
                onClick={() => setDimView(key)}
                sx={{
                  minHeight: 28,
                  px: 1.25,
                  fontSize: '0.75rem',
                  bgcolor: dimView === key ? '#FFFFFF' : 'transparent',
                  color: dimView === key ? '#0F172A' : '#64748B',
                }}
              >
                {label}
              </Button>
            ))}
          </Stack>
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ textTransform: 'capitalize' }}>{dimView}</TableCell>
                <TableCell align="right">Total Tasks</TableCell>
                <TableCell align="right">Active</TableCell>
                <TableCell align="right">Completed</TableCell>
                <TableCell align="right">Overdue</TableCell>
                <TableCell align="right">SLA Breached</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dimRows.map((row) => (
                <TableRow key={row.name}>
                  <TableCell sx={{ fontWeight: 600, color: '#0F172A' }}>{row.name}</TableCell>
                  <TableCell align="right" className="font-mono-num">
                    {row.total}
                  </TableCell>
                  <TableCell align="right" className="font-mono-num">
                    {row.open}
                  </TableCell>
                  <TableCell align="right" className="font-mono-num" sx={{ color: '#16A34A', fontWeight: 600 }}>
                    {row.completed}
                  </TableCell>
                  <TableCell
                    align="right"
                    className="font-mono-num"
                    sx={{ color: row.overdue > 0 ? '#DC2626' : '#475569', fontWeight: row.overdue > 0 ? 600 : 400 }}
                  >
                    {row.overdue}
                  </TableCell>
                  <TableCell
                    align="right"
                    className="font-mono-num"
                    sx={{ color: row.breached > 0 ? '#DC2626' : '#475569', fontWeight: row.breached > 0 ? 600 : 400 }}
                  >
                    {row.breached}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Paper>

      {/* User Productivity Summary Table */}
      <Paper sx={{ overflow: 'hidden' }}>
        <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid #E2E8F0' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            User Productivity Summary
          </Typography>
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Rank</TableCell>
                <TableCell>Team Member</TableCell>
                <TableCell>Role & Branch</TableCell>
                <TableCell align="right">Assigned</TableCell>
                <TableCell align="right">Completed</TableCell>
                <TableCell align="right">Overdue</TableCell>
                <TableCell align="right">SLA Compliance</TableCell>
                <TableCell align="right">Avg Age</TableCell>
                <TableCell align="right">Completion Rate</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.userProductivity.map((row, idx) => (
                <TableRow key={row.userId}>
                  <TableCell className="font-mono-num" sx={{ fontWeight: 700, color: '#1D4ED8' }}>
                    #{idx + 1}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#0F172A' }}>{row.fullName}</TableCell>
                  <TableCell sx={{ color: '#475569' }}>
                    {row.role} · {row.branch}
                  </TableCell>
                  <TableCell align="right" className="font-mono-num">
                    {row.assigned}
                  </TableCell>
                  <TableCell align="right" className="font-mono-num" sx={{ color: '#16A34A', fontWeight: 600 }}>
                    {row.completed}
                  </TableCell>
                  <TableCell
                    align="right"
                    className="font-mono-num"
                    sx={{ color: row.overdue > 0 ? '#DC2626' : '#475569', fontWeight: row.overdue > 0 ? 600 : 400 }}
                  >
                    {row.overdue}
                  </TableCell>
                  <TableCell align="right" className="font-mono-num" sx={{ fontWeight: 600 }}>
                    {row.slaComplianceRate}%
                  </TableCell>
                  <TableCell align="right" className="font-mono-num">
                    {formatTaskAge(row.avgAgeHours)}
                  </TableCell>
                  <TableCell align="right" className="font-mono-num" sx={{ fontWeight: 600 }}>
                    {row.completionRate}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Paper>

      {/* Overdue Tasks Breakdown */}
      <Paper sx={{ overflow: 'hidden' }}>
        <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid #E2E8F0' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Overdue Tasks Detail
          </Typography>
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Task & Location</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>SLA / Age</TableCell>
                <TableCell>Assignee</TableCell>
                <TableCell align="right">Due Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {overdueList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No overdue tasks at this time.
                  </TableCell>
                </TableRow>
              ) : (
                overdueList.map((t) => {
                  const sla = getTaskSlaInfo(t);
                  return (
                    <TableRow
                      key={t.id}
                      hover
                      onClick={() => onSelectTask(t)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell className="font-mono-num" sx={{ fontWeight: 600 }}>
                        {t.taskCode}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {t.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t.area} · {t.branch} · {t.outlet}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <TaskPriorityMark priority={t.priority} />
                      </TableCell>
                      <TableCell>
                        <TaskSlaMark slaStatus={sla.status} />
                        <Typography variant="caption" className="font-mono-num" color="text.secondary" sx={{ display: 'block' }}>
                          Age {formatTaskAge(getTaskAgeHours(t))}
                        </Typography>
                      </TableCell>
                      <TableCell>{t.assigneeName ?? 'Unassigned'}</TableCell>
                      <TableCell align="right" className="font-mono-num" sx={{ color: '#DC2626', fontWeight: 600 }}>
                        {t.dueDate}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Box>
      </Paper>
    </Stack>
  );
}
