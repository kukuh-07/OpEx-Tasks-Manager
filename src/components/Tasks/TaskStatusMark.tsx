import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { SlaStatus, TaskPriority, TaskStatus } from '../../types';

const STATUS_META: Record<
  TaskStatus,
  { color: string; icon: React.ReactNode }
> = {
  Open: {
    color: '#1D4ED8',
    icon: <RadioButtonUncheckedIcon sx={{ fontSize: 15 }} />,
  },
  'In Progress': {
    color: '#D97706',
    icon: <AutorenewIcon sx={{ fontSize: 15 }} />,
  },
  Review: {
    color: '#0369A1',
    icon: <RateReviewOutlinedIcon sx={{ fontSize: 15 }} />,
  },
  Done: {
    color: '#16A34A',
    icon: <CheckCircleOutlinedIcon sx={{ fontSize: 15 }} />,
  },
  Cancelled: {
    color: '#64748B',
    icon: <CancelOutlinedIcon sx={{ fontSize: 15 }} />,
  },
};

const PRIORITY_META: Record<
  TaskPriority,
  { color: string; icon: React.ReactNode }
> = {
  Critical: {
    color: '#DC2626',
    icon: <ErrorOutlinedIcon sx={{ fontSize: 15 }} />,
  },
  High: {
    color: '#D97706',
    icon: <KeyboardDoubleArrowUpIcon sx={{ fontSize: 15 }} />,
  },
  Medium: {
    color: '#1D4ED8',
    icon: <DragHandleIcon sx={{ fontSize: 15 }} />,
  },
  Low: {
    color: '#64748B',
    icon: <KeyboardArrowDownIcon sx={{ fontSize: 15 }} />,
  },
};

const SLA_META: Record<
  SlaStatus,
  { color: string; icon: React.ReactNode }
> = {
  'On Track': {
    color: '#16A34A',
    icon: <ShieldOutlinedIcon sx={{ fontSize: 14 }} />,
  },
  'At Risk': {
    color: '#D97706',
    icon: <AccessTimeIcon sx={{ fontSize: 14 }} />,
  },
  Breached: {
    color: '#DC2626',
    icon: <WarningAmberIcon sx={{ fontSize: 14 }} />,
  },
  Met: {
    color: '#16A34A',
    icon: <CheckCircleOutlinedIcon sx={{ fontSize: 14 }} />,
  },
  Cancelled: {
    color: '#64748B',
    icon: <CancelOutlinedIcon sx={{ fontSize: 14 }} />,
  },
};

export function TaskStatusMark({ status }: { status: TaskStatus }) {
  const meta = STATUS_META[status];
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        color: meta.color,
        whiteSpace: 'nowrap',
      }}
    >
      {meta.icon}
      <Typography
        component="span"
        sx={{ fontSize: '0.8125rem', fontWeight: 600, color: meta.color }}
      >
        {status}
      </Typography>
    </Box>
  );
}

export function TaskPriorityMark({ priority }: { priority: TaskPriority }) {
  const meta = PRIORITY_META[priority];
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        color: meta.color,
        whiteSpace: 'nowrap',
      }}
    >
      {meta.icon}
      <Typography
        component="span"
        sx={{ fontSize: '0.8125rem', fontWeight: 600, color: meta.color }}
      >
        {priority}
      </Typography>
    </Box>
  );
}

export function TaskSlaMark({ slaStatus }: { slaStatus: SlaStatus }) {
  const meta = SLA_META[slaStatus];
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        color: meta.color,
        whiteSpace: 'nowrap',
      }}
    >
      {meta.icon}
      <Typography
        component="span"
        sx={{ fontSize: '0.8125rem', fontWeight: 600, color: meta.color }}
      >
        {slaStatus}
      </Typography>
    </Box>
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
