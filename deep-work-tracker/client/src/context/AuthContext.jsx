import { createContext, useContext, useState } from 'react';
import api, { setAuthToken, getAuthToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(getAuthToken());
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user')) ?? null;
    } catch {
      return null;
    }
  });

  function remember(nextToken, nextUser) {
    setAuthToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
    localStorage.setItem('user', JSON.stringify(nextUser));
  }

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    remember(data.token, data.user);
  }

  async function signup(name, email, password) {
    const { data } = await api.post('/auth/signup', { name, email, password });
    remember(data.token, data.user);
  }

  function logout() {
    setAuthToken(null);
    setToken(null);
    setUser(null);
    localStorage.removeItem('user');
  }

  return (
    <AuthContext.Provider value={{ token, user, isAuthed: !!token, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
