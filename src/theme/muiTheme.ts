import { createTheme } from '@mui/material/styles';

export const muiTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1D4ED8',
      dark: '#1E40AF',
      light: '#EFF6FF',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#0F172A',
      light: '#334155',
      contrastText: '#FFFFFF',
    },
    success: {
      main: '#16A34A',
      light: '#F0FDF4',
      dark: '#15803D',
    },
    warning: {
      main: '#D97706',
      light: '#FFFBEB',
      dark: '#B45309',
    },
    error: {
      main: '#DC2626',
      light: '#FEF2F2',
      dark: '#B91C1C',
    },
    background: {
      default: '#F8FAFC',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#0F172A',
      secondary: '#475569',
    },
    divider: '#E2E8F0',
  },
  typography: {
    fontFamily: '"DM Sans", system-ui, -apple-system, sans-serif',
    h1: {
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      fontWeight: 700,
      letterSpacing: '-0.015em',
    },
    h3: {
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h4: {
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h5: {
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      fontWeight: 600,
    },
    h6: {
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      fontWeight: 600,
    },
    button: {
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      fontWeight: 600,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          border: '1px solid #E2E8F0',
          backgroundImage: 'none',
        },
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          border: '1px solid #E2E8F0',
          boxShadow: 'none',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 7,
          whiteSpace: 'nowrap',
          minHeight: 38,
          paddingLeft: 16,
          paddingRight: 16,
        },
        sizeSmall: {
          minHeight: 32,
          paddingLeft: 12,
          paddingRight: 12,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
          fontWeight: 600,
          fontSize: '0.75rem',
          color: '#475569',
          backgroundColor: '#F8FAFC',
          borderBottom: '1px solid #E2E8F0',
          paddingTop: 10,
          paddingBottom: 10,
        },
        body: {
          fontSize: '0.875rem',
          borderBottom: '1px solid #F1F5F9',
          paddingTop: 10,
          paddingBottom: 10,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 10,
          border: '1px solid #E2E8F0',
          boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.06)',
        },
      },
    },
  },
});
