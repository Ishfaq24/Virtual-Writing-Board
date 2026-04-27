import { useMemo, useState } from 'react';
import AuthForm from './components/AuthForm';
import Whiteboard from './components/Whiteboard';

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
const API_SERVER_URL = import.meta.env.VITE_API_URL || SOCKET_SERVER_URL;

const STORAGE_KEY = 'vwb_auth_session';

function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.user) return null;

    return parsed;
  } catch (_error) {
    return null;
  }
}

function App() {
  const [session, setSession] = useState(() => readStoredSession());

  const isAuthenticated = Boolean(session?.token && session?.user);

  const authData = useMemo(() => (
    {
      token: session?.token || null,
      user: session?.user || null,
    }
  ), [session]);

  const handleAuthSuccess = (payload) => {
    const nextSession = {
      token: payload.token,
      user: payload.user,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
  };

  const handleSignOut = async () => {
    if (session?.token) {
      try {
        await fetch(`${API_SERVER_URL}/api/auth/signout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.token}`,
          },
        });
      } catch (_error) {
        // Client-side session removal is the source of truth for signout.
      }
    }

    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  };

  return (
    <div className="App">
      {isAuthenticated ? (
        <Whiteboard
          authToken={authData.token}
          currentUser={authData.user}
          onSignOut={handleSignOut}
        />
      ) : (
        <AuthForm onAuthSuccess={handleAuthSuccess} />
      )}
    </div>
  );
}

export default App;