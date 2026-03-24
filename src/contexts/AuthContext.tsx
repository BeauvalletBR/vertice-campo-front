import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '@/services/api';
import { toast } from 'sonner';

interface User {
  id: string | number;
  name: string;
  login: string;
  role: "ADMIN" | "COMPRADOR";
}

interface AuthContextType {
  user: User | null;
  login: (loginInput: string, senhaInput: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('@OriginaGoias:user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = async (loginInput: string, senhaInput: string): Promise<boolean> => {
    try {
      const response = await api.realizarLogin(loginInput, senhaInput);
      
      if (response.success && response.user) {
        // Salva os dados do usuário com a ROLE que o n8n mandou
        const loggedUser: User = {
          id: response.user.id,
          name: response.user.name || response.user.login,
          login: response.user.login,
          role: response.user.role || "COMPRADOR"
        };

        setUser(loggedUser);
        localStorage.setItem('@OriginaGoias:user', JSON.stringify(loggedUser));
        toast.success(`Bem-vindo(a), ${loggedUser.name}!`);
        return true;
      } else {
        toast.error(response.message || "Login ou senha incorretos.");
        return false;
      }
    } catch (error) {
      toast.error("Erro ao tentar conectar com o servidor.");
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('@OriginaGoias:user');
    toast.info("Você saiu do sistema.");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}