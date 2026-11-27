import React, { useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import { useAuth } from '../../context/AuthContext';
import {
  downloadExcelImportTemplate,
  parseExcelOrCsvTasks,
  type ParsedImportRow,
} from '../../services/excelService';
import type { CreateTaskInput, UserProfile } from '../../types';
import { TaskPriorityMark, TaskStatusMark } from './TaskStatusMark';

interface ExcelImportDialogProps {
  open: boolean;
  onClose: () => void;
  users: UserProfile[];
  onImportConfirm: (rows: CreateTaskInput[]) => Promise<void>;
}

export function ExcelImportDialog({
  open,
  onClose,
  users,
  onImportConfirm,
}: ExcelImportDialogProps) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validRows = parsedRows.filter((r) => r.valid);

  const resetState = () => {
    setFileName('');
    setParsedRows([]);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleClose = () => {
    if (importing) return;
    resetState();
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setParsing(true);
    setFileName(file.name);
    try {
      const rows = await parseExcelOrCsvTasks(file, users, user);
      setParsedRows(rows);
    } catch (err) {
      setParsedRows([]);
      setError(err instanceof Error ? err.message : 'Failed to parse workbook.');
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      await onImportConfirm(validRows.map((r) => r.payload));
      resetState();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch import failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ fontWeight: 700, borderBottom: '1px solid #E2E8F0' }}>
        Import Tasks from Excel
      </DialogTitle>
      <DialogContent sx={{ pt: 2.5 }}>
        <Stack spacing={2.5}>
          {error && <Alert severity="error">{error}</Alert>}

          <Box
            sx={{
              p: 2.5,
              border: '1px dashed #CBD5E1',
              borderRadius: 1.5,
              bgcolor: '#F8FAFC',
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0F172A' }}>
                {fileName ? `Loaded: ${fileName}` : 'Upload Excel (.xlsx) or CSV Workbook'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Recognized columns: Title, Description, Category, Priority, Status, Area, Branch,
                Outlet, Department, SLA Hours, Due Date, Assignee.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1.25} sx={{ flexShrink: 0, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadOutlinedIcon fontSize="small" />}
                onClick={() => downloadExcelImportTemplate()}
              >
                Template (.xlsx)
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={<UploadFileOutlinedIcon fontSize="small" />}
                disabled={parsing || importing}
                onClick={() => inputRef.current?.click()}
              >
                {parsing ? 'Reading...' : 'Select File'}
              </Button>
            </Stack>

            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.csv"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </Box>

          {parsedRows.length > 0 && (
            <Box>
              <Stack
                direction="row"
                sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Import Preview ({validRows.length} valid of {parsedRows.length} rows)
                </Typography>
                {parsedRows.length - validRows.length > 0 && (
                  <Typography variant="caption" sx={{ color: '#DC2626', fontWeight: 600 }}>
                    {parsedRows.length - validRows.length} invalid rows will be skipped
                  </Typography>
                )}
              </Stack>

              <Box
                sx={{
                  maxHeight: 340,
                  overflow: 'auto',
                  border: '1px solid #E2E8F0',
                  borderRadius: 1.5,
                }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Row</TableCell>
                      <TableCell>Title</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Priority / SLA</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Area / Branch / Outlet</TableCell>
                      <TableCell>Assignee</TableCell>
                      <TableCell>Due Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {parsedRows.map((row) => (
                      <TableRow
                        key={row.rowNumber}
                        sx={{ bgcolor: row.valid ? '#FFFFFF' : '#FEF2F2' }}
                      >
                        <TableCell className="font-mono-num">{row.rowNumber}</TableCell>
                        <TableCell sx={{ maxWidth: 240 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                            {row.payload.title || '—'}
                          </Typography>
                          {row.error && (
                            <Typography variant="caption" sx={{ color: '#DC2626' }}>
                              {row.error}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>{row.payload.category}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                            <TaskPriorityMark priority={row.payload.priority} />
                            <Typography variant="caption" className="font-mono-num" color="text.secondary">
                              · {row.payload.slaHours}h
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <TaskStatusMark status={row.payload.status ?? 'Open'} />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.75rem', color: '#475569' }}>
                          {row.payload.area} · {row.payload.branch} · {row.payload.outlet}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8125rem' }}>{row.assigneeLabel}</TableCell>
                        <TableCell className="font-mono-num">
                          {row.payload.dueDate ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #E2E8F0' }}>
        <Button onClick={handleClose} color="inherit" disabled={importing}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={validRows.length === 0 || importing}
          onClick={handleImport}
        >
          {importing
            ? 'Importing...'
            : `Import ${validRows.length} Task${validRows.length === 1 ? '' : 's'}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
