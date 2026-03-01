import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface AuthContextType {
  authenticated: boolean;
  loading: boolean;
  user: string | null;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  authenticated: false,
  loading: true,
  user: null,
  login: async () => false,
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<string | null>(null);

  // Check session on mount
  useEffect(() => {
    fetch('/auth/me', { credentials: 'include' })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Not authenticated');
      })
      .then((data) => {
        setAuthenticated(true);
        setUser(data.user);
      })
      .catch(() => {
        setAuthenticated(false);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (password: string): Promise<boolean> => {
    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `password=${encodeURIComponent(password)}`,
        credentials: 'include',
        redirect: 'manual', // Don't follow redirect — we handle it ourselves
      });

      // The server responds with a 302 redirect on success
      // fetch with redirect: 'manual' returns an opaque redirect (status 0) or 200
      if (res.type === 'opaqueredirect' || res.status === 200 || res.status === 302) {
        // Verify the session actually works
        const check = await fetch('/auth/me', { credentials: 'include' });
        if (check.ok) {
          const data = await check.json();
          setAuthenticated(true);
          setUser(data.user);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  };

  const logout = () => {
    fetch('/logout', { credentials: 'include' }).finally(() => {
      setAuthenticated(false);
      setUser(null);
    });
  };

  return (
    <AuthContext.Provider value={{ authenticated, loading, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
