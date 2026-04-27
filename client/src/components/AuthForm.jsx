import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
const API_SERVER_URL = import.meta.env.VITE_API_URL || SOCKET_SERVER_URL;

function AuthForm({ onAuthSuccess }) {
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const endpoint = useMemo(() => (
    mode === 'signup' ? '/api/auth/signup' : '/api/auth/signin'
  ), [mode]);

  const handleModeChange = (_event, value) => {
    if (!value) return;
    setMode(value);
    setError(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const body = {
        email,
        password,
      };

      if (mode === 'signup') {
        body.name = name;
      }

      const response = await fetch(`${API_SERVER_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || 'Authentication failed.');
      }

      if (payload?.token && payload?.user) {
        onAuthSuccess(payload);
      } else {
        throw new Error('Unexpected response from server.');
      }
    } catch (submitError) {
      setError(submitError?.message || 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        background: 'radial-gradient(circle at top right, #dbeafe 0%, #f8fafc 40%, #e2e8f0 100%)',
      }}
    >
      <Paper elevation={6} sx={{ width: '100%', maxWidth: 480, borderRadius: 3, p: 4 }}>
        <Typography variant="overline" sx={{ color: '#2563eb', letterSpacing: 1 }}>
          Virtual Writing Board
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#0f172a', mb: 1 }}>
          Secure Workspace
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Sign in to continue or create a new account to save your boards as PDFs.
        </Typography>

        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={handleModeChange}
          fullWidth
          sx={{ mb: 2 }}
        >
          <ToggleButton value="signin">Sign in</ToggleButton>
          <ToggleButton value="signup">Sign up</ToggleButton>
        </ToggleButtonGroup>

        <Stack component="form" spacing={2} onSubmit={handleSubmit}>
          {mode === 'signup' ? (
            <TextField
              label="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          ) : null}
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            helperText={mode === 'signup' ? 'Minimum 6 characters.' : ''}
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
            {isSubmitting
              ? (mode === 'signup' ? 'Creating account...' : 'Signing in...')
              : (mode === 'signup' ? 'Create account' : 'Sign in')}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

export default AuthForm;
