import { useMemo, useState } from 'react';
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
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { exportTasksToExcel } from '../../services/excelService';
import { buildReportFromData } from '../../services/reportService';
import {
  formatTaskAge,
  getTaskAgeHours,
  getTaskSlaInfo,
  isTaskDueSoon,
  isTaskOverdue,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type UserProfile,
} from '../../types';
import { TaskPriorityMark, TaskSlaMark, TaskStatusMark } from '../Tasks/TaskStatusMark';
import type { TaskStatusFilterValue } from '../Tasks/TasksPage';

interface DashboardPageProps {
  tasks: Task[];
  users: UserProfile[];
  onSelectTask: (task: Task) => void;
  onFilterTasks: (status?: TaskStatusFilterValue) => void;
  onOpenImport: () => void;
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  Open: '#1D4ED8',
  'In Progress': '#D97706',
  Review: '#0369A1',
  Done: '#16A34A',
  Cancelled: '#94A3B8',
};

const AGING_COLORS: Record<string, string> = {
  '0-1 Days': '#16A34A',
  '2-3 Days': '#1D4ED8',
  '4-7 Days': '#D97706',
  '8+ Days': '#DC2626',
};

interface TrendPoint {
  key: string;
  label: string;
  created: number;
  completed: number;
  overdue: number;
}

export function DashboardPage({
  tasks,
  users,
  onSelectTask,
  onFilterTasks,
  onOpenImport,
}: DashboardPageProps) {
  const summary = useMemo(() => buildReportFromData(tasks, users), [tasks, users]);
  const [trendMode, setTrendMode] = useState<'monthly' | 'daily'>('monthly');
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number | null>(null);
  const [hoveredStatus, setHoveredStatus] = useState<TaskStatus | null>(null);
  const [dimTab, setDimTab] = useState<'category' | 'area' | 'branch' | 'outlet'>('category');
  const [exporting, setExporting] = useState(false);

  const overdueTasksList = useMemo(
    () => tasks.filter((t) => isTaskOverdue(t)),
    [tasks]
  );
  const dueSoonTasksList = useMemo(
    () => tasks.filter((t) => !isTaskOverdue(t) && isTaskDueSoon(t)),
    [tasks]
  );

  // Build 14-day daily trend in addition to 6-month trend
  const dailyTrend: TrendPoint[] = useMemo(() => {
    const rows: TrendPoint[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - i);
      const ymd = d.toISOString().slice(0, 10);
      const label = d.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      const created = tasks.filter((t) => t.createdAt.slice(0, 10) === ymd).length;
      const completed = tasks.filter(
        (t) => t.completedAt && t.completedAt.slice(0, 10) === ymd
      ).length;
      const overdue = tasks.filter(
        (t) => t.dueDate === ymd && isTaskOverdue(t)
      ).length;
      rows.push({ key: ymd, label, created, completed, overdue });
    }
    return rows;
  }, [tasks]);

  const trendData: TrendPoint[] = useMemo(
    () =>
      trendMode === 'monthly'
        ? summary.monthlySummary.map((m) => ({
            key: m.month,
            label: m.label,
            created: m.created,
            completed: m.completed,
            overdue: m.overdue,
          }))
        : dailyTrend,
    [trendMode, summary.monthlySummary, dailyTrend]
  );

  const activePipeline = summary.openTasks + summary.inProgressTasks + summary.reviewTasks;

  const kpis: Array<{
    label: string;
    value: string | number;
    subtext: string;
    tone?: string;
    filter?: TaskStatusFilterValue;
  }> = [
    {
      label: 'Total Tasks',
      value: summary.totalTasks,
      subtext: `${activePipeline} active in pipeline`,
    },
    {
      label: 'Completed',
      value: summary.completedTasks,
      subtext: `${summary.completionRate}% completion rate`,
      tone: '#16A34A',
      filter: 'Done',
    },
    {
      label: 'Due Soon Alert',
      value: summary.dueSoonTasks,
      subtext: 'Due within 48 hours',
      tone: '#D97706',
      filter: 'Due Soon',
    },
    {
      label: 'Overdue Alert',
      value: summary.overdueTasks,
      subtext: `${summary.slaBreached} SLA breached`,
      tone: '#DC2626',
      filter: 'Overdue',
    },
    {
      label: 'SLA Compliance',
      value: `${summary.slaComplianceRate}%`,
      subtext: `${summary.slaAtRisk} at risk · ${summary.slaOnTrack} on track`,
      tone: summary.slaComplianceRate >= 85 ? '#16A34A' : '#D97706',
    },
    {
      label: 'Avg Task Age',
      value: formatTaskAge(summary.avgAgeHours),
      subtext: `${summary.byAgingBucket[3]?.count ?? 0} aged 8+ days`,
      tone: '#0F172A',
    },
  ];

  // SVG Trend Chart Geometry
  const chartW = 640;
  const chartH = 220;
  const padL = 34;
  const padR = 16;
  const padT = 18;
  const padB = 30;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;
  const maxTrendVal = Math.max(
    2,
    ...trendData.map((d) => Math.max(d.created, d.completed, d.overdue))
  );
  const yTicks = [0, Math.ceil(maxTrendVal / 2), maxTrendVal];
  const stepX = trendData.length > 1 ? innerW / (trendData.length - 1) : innerW;

  const getCoord = (idx: number, val: number) => ({
    x: padL + (trendData.length > 1 ? idx * stepX : innerW / 2),
    y: padT + innerH - (val / maxTrendVal) * innerH,
  });

  const buildPolyline = (pick: (d: TrendPoint) => number) =>
    trendData.map((d, i) => {
      const pt = getCoord(i, pick(d));
      return `${pt.x},${pt.y}`;
    }).join(' ');

  const buildAreaPath = (pick: (d: TrendPoint) => number) => {
    if (trendData.length === 0) return '';
    const pts = trendData.map((d, i) => getCoord(i, pick(d)));
    const first = pts[0];
    const last = pts[pts.length - 1];
    const baseY = padT + innerH;
    return `M ${first.x} ${baseY} ` + pts.map((p) => `L ${p.x} ${p.y}`).join(' ') + ` L ${last.x} ${baseY} Z`;
  };

  // SVG Donut Chart Geometry
  const donutSize = 176;
  const donutRadius = 64;
  const donutStroke = 22;
  const donutCirc = 2 * Math.PI * donutRadius;
  const statusTotal = Math.max(1, summary.totalTasks);

  let cumulativeFraction = 0;
  const donutSegments = summary.byStatus.map((row) => {
    const fraction = summary.totalTasks > 0 ? row.count / statusTotal : 0;
    const dashArray = `${fraction * donutCirc} ${donutCirc}`;
    const dashOffset = -cumulativeFraction * donutCirc;
    cumulativeFraction += fraction;
    return {
      ...row,
      pct: summary.totalTasks > 0 ? Math.round((row.count / summary.totalTasks) * 100) : 0,
      dashArray,
      dashOffset,
      color: STATUS_COLORS[row.status],
    };
  });

  const activeDonutInfo = hoveredStatus
    ? donutSegments.find((s) => s.status === hoveredStatus)
    : null;

  const dimensionRows =
    dimTab === 'category'
      ? summary.byCategory
      : dimTab === 'area'
        ? summary.byArea
        : dimTab === 'branch'
          ? summary.byBranch
          : summary.byOutlet;

  const maxDimTotal = Math.max(1, ...dimensionRows.map((d) => d.total));

  const priorityQueue = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== 'Done' && t.status !== 'Cancelled')
        .sort((a, b) => {
          const aOver = isTaskOverdue(a) ? 2 : isTaskDueSoon(a) ? 1 : 0;
          const bOver = isTaskOverdue(b) ? 2 : isTaskDueSoon(b) ? 1 : 0;
          if (aOver !== bOver) return bOver - aOver;
          const weight: Record<TaskPriority, number> = {
            Critical: 4,
            High: 3,
            Medium: 2,
            Low: 1,
          };
          return weight[b.priority] - weight[a.priority];
        })
        .slice(0, 6),
    [tasks]
  );

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      await exportTasksToExcel(tasks, 'opex-dashboard-tasks.xlsx');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Stack spacing={3}>
      {/* Page Header */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' } }}
      >
        <Box>
          <Typography variant="h4" sx={{ color: '#0F172A' }}>
            Operational Overview
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            KPI tracking, SLA monitoring, task aging, location coverage, and team productivity rankings.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<UploadFileOutlinedIcon fontSize="small" />}
            onClick={onOpenImport}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Import Excel
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadOutlinedIcon fontSize="small" />}
            disabled={exporting || tasks.length === 0}
            onClick={handleExportExcel}
            sx={{ whiteSpace: 'nowrap' }}
          >
            {exporting ? 'Exporting...' : 'Export Excel'}
          </Button>
          <Button
            variant="contained"
            size="small"
            endIcon={<ArrowForwardIcon fontSize="small" />}
            onClick={() => onFilterTasks(undefined)}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Open Task Board
          </Button>
        </Stack>
      </Stack>

      {/* Overdue Alert & Due Soon Alert Strip */}
      {(overdueTasksList.length > 0 || dueSoonTasksList.length > 0) && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md:
                overdueTasksList.length > 0 && dueSoonTasksList.length > 0
                  ? '1fr 1fr'
                  : '1fr',
            },
            gap: 2,
          }}
        >
          {overdueTasksList.length > 0 && (
            <Paper
              sx={{
                p: 2,
                bgcolor: '#FEF2F2',
                borderColor: '#FECACA',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', minWidth: 0 }}>
                <WarningAmberIcon sx={{ color: '#DC2626', fontSize: 22, mt: 0.25, flexShrink: 0 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#991B1B' }}>
                    Overdue Alert · {overdueTasksList.length} Task{overdueTasksList.length === 1 ? '' : 's'} Past Due
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#7F1D1D', display: 'block', mt: 0.25 }} noWrap>
                    Top priority: {overdueTasksList[0].taskCode} ({overdueTasksList[0].title}) ·{' '}
                    {overdueTasksList[0].branch}
                  </Typography>
                </Box>
              </Stack>
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={() => onFilterTasks('Overdue')}
                sx={{ whiteSpace: 'nowrap', flexShrink: 0, bgcolor: '#FFFFFF' }}
              >
                Review Overdue
              </Button>
            </Paper>
          )}

          {dueSoonTasksList.length > 0 && (
            <Paper
              sx={{
                p: 2,
                bgcolor: '#FFFBEB',
                borderColor: '#FDE68A',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', minWidth: 0 }}>
                <AccessTimeIcon sx={{ color: '#D97706', fontSize: 22, mt: 0.25, flexShrink: 0 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#92400E' }}>
                    Due Soon Alert · {dueSoonTasksList.length} Task{dueSoonTasksList.length === 1 ? '' : 's'} Due Within 48h
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#78350F', display: 'block', mt: 0.25 }} noWrap>
                    Approaching: {dueSoonTasksList[0].taskCode} ({dueSoonTasksList[0].title}) · Due{' '}
                    {dueSoonTasksList[0].dueDate}
                  </Typography>
                </Box>
              </Stack>
              <Button
                size="small"
                variant="outlined"
                color="warning"
                onClick={() => onFilterTasks('Due Soon')}
                sx={{ whiteSpace: 'nowrap', flexShrink: 0, bgcolor: '#FFFFFF' }}
              >
                Review Due Soon
              </Button>
            </Paper>
          )}
        </Box>
      )}

      {/* 6-Column KPI Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            sm: 'repeat(3, 1fr)',
            xl: 'repeat(6, 1fr)',
          },
          gap: 2,
        }}
      >
        {kpis.map((kpi) => (
          <Paper
            key={kpi.label}
            onClick={() => kpi.filter !== undefined && onFilterTasks(kpi.filter)}
            sx={{
              p: 2.25,
              cursor: kpi.filter ? 'pointer' : 'default',
              transition: 'border-color 150ms ease',
              '&:hover': kpi.filter ? { borderColor: '#94A3B8' } : undefined,
            }}
          >
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
              {kpi.label}
            </Typography>
            <Typography
              variant="h4"
              className="font-mono-num"
              sx={{
                mt: 0.5,
                color: kpi.tone ?? '#0F172A',
                fontWeight: 700,
              }}
            >
              {kpi.value}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {kpi.subtext}
            </Typography>
          </Paper>
        ))}
      </Box>

      {/* Primary Charts Row: Task Trend Chart + Status Distribution Chart */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '7fr 5fr' },
          gap: 2.5,
        }}
      >
        {/* Task Trend Chart */}
        <Paper sx={{ p: 2.5 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 2 }}
          >
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Task Trend Chart
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Created vs Completed vs Overdue throughput
              </Typography>
            </Box>

            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Stack direction="row" spacing={1.5} sx={{ fontSize: '0.75rem' }}>
                <Typography variant="caption" sx={{ color: '#1D4ED8', fontWeight: 600 }}>
                  Created
                </Typography>
                <Typography variant="caption" sx={{ color: '#16A34A', fontWeight: 600 }}>
                  Completed
                </Typography>
                <Typography variant="caption" sx={{ color: '#DC2626', fontWeight: 600 }}>
                  Overdue
                </Typography>
              </Stack>

              <Stack
                direction="row"
                spacing={0.5}
                sx={{ p: 0.35, bgcolor: '#F1F5F9', borderRadius: 1 }}
              >
                <Button
                  size="small"
                  onClick={() => setTrendMode('monthly')}
                  sx={{
                    minHeight: 26,
                    px: 1,
                    fontSize: '0.75rem',
                    bgcolor: trendMode === 'monthly' ? '#FFFFFF' : 'transparent',
                    color: trendMode === 'monthly' ? '#0F172A' : '#64748B',
                  }}
                >
                  6 Months
                </Button>
                <Button
                  size="small"
                  onClick={() => setTrendMode('daily')}
                  sx={{
                    minHeight: 26,
                    px: 1,
                    fontSize: '0.75rem',
                    bgcolor: trendMode === 'daily' ? '#FFFFFF' : 'transparent',
                    color: trendMode === 'daily' ? '#0F172A' : '#64748B',
                  }}
                >
                  14 Days
                </Button>
              </Stack>
            </Stack>
          </Stack>

          <Box sx={{ position: 'relative', width: '100%' }}>
            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              width="100%"
              height="auto"
              role="img"
              aria-label="Task Trend Chart"
              style={{ display: 'block', overflow: 'visible' }}
            >
              <defs>
                <linearGradient id="trendCreatedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1D4ED8" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.01" />
                </linearGradient>
                <linearGradient id="trendCompletedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16A34A" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#16A34A" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* Horizontal Gridlines & Y Labels */}
              {yTicks.map((tick) => {
                const y = padT + innerH - (tick / maxTrendVal) * innerH;
                return (
                  <g key={tick}>
                    <line
                      x1={padL}
                      x2={chartW - padR}
                      y1={y}
                      y2={y}
                      stroke="#E2E8F0"
                      strokeDasharray={tick === 0 ? undefined : '3 3'}
                    />
                    <text
                      x={padL - 8}
                      y={y + 4}
                      textAnchor="end"
                      fill="#64748B"
                      fontSize="11"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}

              {/* Area Fills */}
              <path d={buildAreaPath((d) => d.created)} fill="url(#trendCreatedGrad)" />
              <path d={buildAreaPath((d) => d.completed)} fill="url(#trendCompletedGrad)" />

              {/* Lines */}
              <polyline
                fill="none"
                stroke="#1D4ED8"
                strokeWidth="2.25"
                strokeLinejoin="round"
                points={buildPolyline((d) => d.created)}
              />
              <polyline
                fill="none"
                stroke="#16A34A"
                strokeWidth="2.25"
                strokeLinejoin="round"
                points={buildPolyline((d) => d.completed)}
              />
              <polyline
                fill="none"
                stroke="#DC2626"
                strokeWidth="1.75"
                strokeDasharray="4 3"
                strokeLinejoin="round"
                points={buildPolyline((d) => d.overdue)}
              />

              {/* Hover Vertical Guide + Data Points + X Labels */}
              {trendData.map((d, i) => {
                const cPt = getCoord(i, d.created);
                const compPt = getCoord(i, d.completed);
                const overPt = getCoord(i, d.overdue);
                const showLabel =
                  trendMode === 'monthly' || i % 2 === 0 || i === trendData.length - 1;
                const isHovered = hoveredTrendIdx === i;

                return (
                  <g
                    key={d.key}
                    onMouseEnter={() => setHoveredTrendIdx(i)}
                    onMouseLeave={() => setHoveredTrendIdx(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    {isHovered && (
                      <line
                        x1={cPt.x}
                        x2={cPt.x}
                        y1={padT}
                        y2={padT + innerH}
                        stroke="#94A3B8"
                        strokeWidth="1"
                      />
                    )}
                    <circle
                      cx={cPt.x}
                      cy={cPt.y}
                      r={isHovered ? 4.5 : 3}
                      fill="#1D4ED8"
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx={compPt.x}
                      cy={compPt.y}
                      r={isHovered ? 4.5 : 3}
                      fill="#16A34A"
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />
                    {d.overdue > 0 && (
                      <circle
                        cx={overPt.x}
                        cy={overPt.y}
                        r={isHovered ? 4 : 2.75}
                        fill="#DC2626"
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                      />
                    )}
                    {showLabel && (
                      <text
                        x={cPt.x}
                        y={chartH - 8}
                        textAnchor="middle"
                        fill={isHovered ? '#0F172A' : '#64748B'}
                        fontWeight={isHovered ? 700 : 400}
                        fontSize="10.5"
                        fontFamily="DM Sans, sans-serif"
                      >
                        {trendMode === 'monthly' ? d.label.split(' ')[0] : d.label}
                      </text>
                    )}
                    {/* Wide invisible hit target */}
                    <rect
                      x={cPt.x - Math.max(12, stepX / 2)}
                      y={padT}
                      width={Math.max(24, stepX)}
                      height={innerH + padB}
                      fill="transparent"
                    />
                  </g>
                );
              })}
            </svg>

            {hoveredTrendIdx !== null && trendData[hoveredTrendIdx] && (
              <Box
                sx={{
                  mt: 1,
                  px: 1.5,
                  py: 0.75,
                  bgcolor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 1,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 1.5,
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#0F172A' }}>
                  {trendData[hoveredTrendIdx].label}
                </Typography>
                <Stack direction="row" spacing={2} className="font-mono-num">
                  <Typography variant="caption" sx={{ color: '#1D4ED8', fontWeight: 600 }}>
                    Created: {trendData[hoveredTrendIdx].created}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#16A34A', fontWeight: 600 }}>
                    Completed: {trendData[hoveredTrendIdx].completed}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#DC2626', fontWeight: 600 }}>
                    Overdue: {trendData[hoveredTrendIdx].overdue}
                  </Typography>
                </Stack>
              </Box>
            )}
          </Box>
        </Paper>

        {/* Status Distribution Chart */}
        <Paper sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Status Distribution Chart
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Click or hover any status segment to inspect distribution
          </Typography>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2.5}
            sx={{ alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Box sx={{ position: 'relative', width: donutSize, height: donutSize, flexShrink: 0 }}>
              <svg width={donutSize} height={donutSize} viewBox={`0 0 ${donutSize} ${donutSize}`}>
                <circle
                  cx={donutSize / 2}
                  cy={donutSize / 2}
                  r={donutRadius}
                  fill="none"
                  stroke="#F1F5F9"
                  strokeWidth={donutStroke}
                />
                <g transform={`rotate(-90 ${donutSize / 2} ${donutSize / 2})`}>
                  {donutSegments.map((seg) => {
                    if (seg.count === 0) return null;
                    const active = hoveredStatus === seg.status;
                    return (
                      <circle
                        key={seg.status}
                        cx={donutSize / 2}
                        cy={donutSize / 2}
                        r={donutRadius}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth={active ? donutStroke + 4 : donutStroke}
                        strokeDasharray={seg.dashArray}
                        strokeDashoffset={seg.dashOffset}
                        style={{ cursor: 'pointer', transition: 'stroke-width 150ms ease' }}
                        onMouseEnter={() => setHoveredStatus(seg.status)}
                        onMouseLeave={() => setHoveredStatus(null)}
                        onClick={() => onFilterTasks(seg.status)}
                      />
                    );
                  })}
                </g>
              </svg>
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  textAlign: 'center',
                }}
              >
                <Typography variant="h4" className="font-mono-num" sx={{ fontWeight: 700, color: '#0F172A' }}>
                  {activeDonutInfo ? activeDonutInfo.count : summary.totalTasks}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {activeDonutInfo ? `${activeDonutInfo.status} (${activeDonutInfo.pct}%)` : 'Total Tasks'}
                </Typography>
              </Box>
            </Box>

            <Stack spacing={1.25} sx={{ flex: 1, width: '100%' }}>
              {donutSegments.map((seg) => (
                <Box
                  key={seg.status}
                  onMouseEnter={() => setHoveredStatus(seg.status)}
                  onMouseLeave={() => setHoveredStatus(null)}
                  onClick={() => onFilterTasks(seg.status)}
                  sx={{
                    cursor: 'pointer',
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    bgcolor: hoveredStatus === seg.status ? '#F8FAFC' : 'transparent',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <TaskStatusMark status={seg.status} />
                  <Typography variant="body2" className="font-mono-num" sx={{ fontWeight: 600 }}>
                    {seg.count}{' '}
                    <span style={{ color: '#64748B', fontWeight: 400 }}>({seg.pct}%)</span>
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Stack>
        </Paper>
      </Box>

      {/* Middle Analytics Row: SLA Monitoring, Task Aging, Category / Location Assignment */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, 1fr)' },
          gap: 2.5,
        }}
      >
        {/* SLA Monitoring */}
        <Paper sx={{ p: 2.5 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                SLA Monitoring
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Compliance across active and completed SLA windows
              </Typography>
            </Box>
            <Typography
              variant="h5"
              className="font-mono-num"
              sx={{ fontWeight: 700, color: summary.slaComplianceRate >= 85 ? '#16A34A' : '#D97706' }}
            >
              {summary.slaComplianceRate}%
            </Typography>
          </Stack>

          <Stack spacing={1.5}>
            {[
              { label: 'On Track' as const, count: summary.slaOnTrack, color: '#16A34A' },
              { label: 'At Risk' as const, count: summary.slaAtRisk, color: '#D97706' },
              { label: 'Breached' as const, count: summary.slaBreached, color: '#DC2626' },
              { label: 'Met' as const, count: summary.slaMet, color: '#0369A1' },
            ].map((row) => {
              const denom = Math.max(
                1,
                summary.slaOnTrack + summary.slaAtRisk + summary.slaBreached + summary.slaMet
              );
              const pct = Math.round((row.count / denom) * 100);
              return (
                <Box key={row.label}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <TaskSlaMark slaStatus={row.label} />
                    <Typography variant="body2" className="font-mono-num" sx={{ fontWeight: 600 }}>
                      {row.count} ({pct}%)
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      bgcolor: '#F1F5F9',
                      '& .MuiLinearProgress-bar': { bgcolor: row.color },
                    }}
                  />
                </Box>
              );
            })}
          </Stack>
        </Paper>

        {/* Task Aging */}
        <Paper sx={{ p: 2.5 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Task Aging
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Open pipeline age distribution
              </Typography>
            </Box>
            <Typography variant="h5" className="font-mono-num" sx={{ fontWeight: 700, color: '#0F172A' }}>
              {formatTaskAge(summary.avgAgeHours)}
            </Typography>
          </Stack>

          <Stack spacing={1.5}>
            {summary.byAgingBucket.map((row) => {
              const denom = Math.max(1, activePipeline);
              const pct = Math.round((row.count / denom) * 100);
              return (
                <Box key={row.bucket}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
                      {row.bucket}
                    </Typography>
                    <Typography variant="body2" className="font-mono-num" sx={{ fontWeight: 600 }}>
                      {row.count} ({pct}%)
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      bgcolor: '#F1F5F9',
                      '& .MuiLinearProgress-bar': { bgcolor: AGING_COLORS[row.bucket] ?? '#1D4ED8' },
                    }}
                  />
                </Box>
              );
            })}
          </Stack>
        </Paper>

        {/* Category / Area / Branch / Outlet Breakdown */}
        <Paper sx={{ p: 2.5 }}>
          <Stack
            direction="row"
            sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5, gap: 1, flexWrap: 'wrap' }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Scope & Location
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
                  onClick={() => setDimTab(key)}
                  sx={{
                    minHeight: 24,
                    minWidth: 0,
                    px: 0.9,
                    fontSize: '0.7rem',
                    bgcolor: dimTab === key ? '#FFFFFF' : 'transparent',
                    color: dimTab === key ? '#0F172A' : '#64748B',
                  }}
                >
                  {label}
                </Button>
              ))}
            </Stack>
          </Stack>

          <Stack spacing={1.35}>
            {dimensionRows.slice(0, 5).map((row) => {
              const pct = Math.round((row.total / maxDimTotal) * 100);
              return (
                <Box key={row.name}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.35, gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: '#0F172A' }} noWrap>
                      {row.name}
                    </Typography>
                    <Typography variant="caption" className="font-mono-num" sx={{ fontWeight: 600, flexShrink: 0 }}>
                      {row.total}
                      {row.overdue > 0 ? (
                        <span style={{ color: '#DC2626', marginLeft: 5 }}>
                          ({row.overdue} overdue)
                        </span>
                      ) : null}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    sx={{
                      height: 5,
                      borderRadius: 3,
                      bgcolor: '#F1F5F9',
                      '& .MuiLinearProgress-bar': { bgcolor: '#1D4ED8' },
                    }}
                  />
                </Box>
              );
            })}
          </Stack>
        </Paper>
      </Box>

      {/* Productivity Ranking */}
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
            gap: 1,
          }}
        >
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Productivity Ranking
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Ranked by completion rate, SLA adherence, and overdue minimization
            </Typography>
          </Box>
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Rank</TableCell>
                <TableCell>Team Member</TableCell>
                <TableCell>Area / Branch</TableCell>
                <TableCell align="right">Assigned</TableCell>
                <TableCell align="right">Completed</TableCell>
                <TableCell align="right">Overdue</TableCell>
                <TableCell align="right">SLA Compliance</TableCell>
                <TableCell align="right">Completion Rate</TableCell>
                <TableCell align="right">Score</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.userProductivity.map((row, idx) => (
                <TableRow key={row.userId}>
                  <TableCell
                    className="font-mono-num"
                    sx={{
                      fontWeight: 700,
                      color: idx === 0 ? '#1D4ED8' : idx < 3 ? '#0F172A' : '#64748B',
                    }}
                  >
                    #{idx + 1}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A' }}>
                      {row.fullName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.role} · {row.department}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ color: '#475569', fontSize: '0.8125rem' }}>
                    {row.area} · {row.branch}
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
                  <TableCell align="right" sx={{ minWidth: 130 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
                      <LinearProgress
                        variant="determinate"
                        value={row.completionRate}
                        sx={{
                          width: 64,
                          height: 5,
                          borderRadius: 3,
                          bgcolor: '#F1F5F9',
                          '& .MuiLinearProgress-bar': { bgcolor: '#16A34A' },
                        }}
                      />
                      <span className="font-mono-num" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                        {row.completionRate}%
                      </span>
                    </Stack>
                  </TableCell>
                  <TableCell align="right" className="font-mono-num" sx={{ fontWeight: 700, color: '#1D4ED8' }}>
                    {row.productivityScore}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Paper>

      {/* Priority & SLA Action Queue */}
      <Paper sx={{ overflow: 'hidden' }}>
        <Box
          sx={{
            px: 2.5,
            py: 2,
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Priority & SLA Action Queue
          </Typography>
          <Button size="small" onClick={() => onFilterTasks('Overdue')}>
            View Overdue
          </Button>
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Task & Location</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>SLA / Age</TableCell>
                <TableCell>Assignee</TableCell>
                <TableCell align="right">Due Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {priorityQueue.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    All active tasks are completed or cleared.
                  </TableCell>
                </TableRow>
              ) : (
                priorityQueue.map((t) => {
                  const overdue = isTaskOverdue(t);
                  const dueSoon = !overdue && isTaskDueSoon(t);
                  const sla = getTaskSlaInfo(t);
                  return (
                    <TableRow
                      key={t.id}
                      hover
                      onClick={() => onSelectTask(t)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell className="font-mono-num" sx={{ fontWeight: 600, color: '#475569' }}>
                        {t.taskCode}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 280 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A' }} noWrap>
                          {t.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                          {t.area} · {t.branch} · {t.outlet}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8125rem', color: '#334155', whiteSpace: 'nowrap' }}>
                        {t.category}
                      </TableCell>
                      <TableCell>
                        <TaskPriorityMark priority={t.priority} />
                      </TableCell>
                      <TableCell>
                        <TaskStatusMark status={t.status} />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <TaskSlaMark slaStatus={sla.status} />
                        <Typography variant="caption" className="font-mono-num" color="text.secondary" sx={{ display: 'block' }}>
                          Age {formatTaskAge(getTaskAgeHours(t))}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ color: '#475569' }}>
                        {t.assigneeName ?? 'Unassigned'}
                      </TableCell>
                      <TableCell
                        align="right"
                        className="font-mono-num"
                        sx={{
                          color: overdue ? '#DC2626' : dueSoon ? '#D97706' : '#475569',
                          fontWeight: overdue || dueSoon ? 600 : 400,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t.dueDate
                          ? `${t.dueDate}${overdue ? ' · Overdue' : dueSoon ? ' · Due Soon' : ''}`
                          : '—'}
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
