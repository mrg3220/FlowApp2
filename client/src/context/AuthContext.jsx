import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('flowapp_user');
    const storedToken = localStorage.getItem('flowapp_token');

    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      // Verify token is still valid
      authApi.getMe().then((data) => {
        setUser(data.user);
        localStorage.setItem('flowapp_user', JSON.stringify(data.user));
      }).catch(() => {
        localStorage.removeItem('flowapp_user');
        localStorage.removeItem('flowapp_token');
        setUser(null);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await authApi.login(email, password);
    localStorage.setItem('flowapp_token', data.token);
    localStorage.setItem('flowapp_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const register = async (formData) => {
    const data = await authApi.register(formData);
    localStorage.setItem('flowapp_token', data.token);
    localStorage.setItem('flowapp_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('flowapp_token');
    localStorage.removeItem('flowapp_user');
    setUser(null);
  };

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isOwner = user?.role === 'OWNER';
  const isInstructor = user?.role === 'INSTRUCTOR';
  const isStudent = user?.role === 'STUDENT';
  const isEventCoordinator = user?.role === 'EVENT_COORDINATOR';
  const isMarketing = user?.role === 'MARKETING';
  const isSchoolStaff = user?.role === 'SCHOOL_STAFF';
  const isITAdmin = user?.role === 'IT_ADMIN';
  const isStaff = isSuperAdmin || isOwner || isInstructor || isSchoolStaff;
  const isHQ = isSuperAdmin || isEventCoordinator || isMarketing;
  const isAdmin = isSuperAdmin || isITAdmin;

  return (
    <AuthContext.Provider value={{
      user, loading, login, register, logout,
      isSuperAdmin, isOwner, isInstructor, isStudent,
      isEventCoordinator, isMarketing, isSchoolStaff,
      isITAdmin, isStaff, isHQ, isAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
