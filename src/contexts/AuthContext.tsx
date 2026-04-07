import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '@/services/api';
import { toast } from 'sonner';

export interface User {
  id: string | number;
  name: string;
  login: string;
  role: "ADMIN" | "COMPRADOR";
  empresa?: string;
  modulos?: string[]; // <-- ADICIONADO: Agora o React sabe que existe uma lista de módulos
}

interface AuthContextType {
  user: User | null;
  login: (loginInput: string, senhaInput: string, empresa: string) => Promise<boolean>;
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

  const login = async (loginInput: string, senhaInput: string, empresa: string): Promise<boolean> => {
    try {
      const response = await api.realizarLogin(loginInput, senhaInput, empresa);
      
      if (response.success && response.user) {
        // 👇 AGORA SALVAMOS OS MÓDULOS QUE VIERAM DO N8N/PYTHON
        const loggedUser: User = {
          id: response.user.id,
          name: response.user.name || response.user.login,
          login: response.user.login,
          role: response.user.role || "COMPRADOR",
          empresa: empresa, 
          modulos: response.user.modulos || [] // <-- ADICIONADO: Salvando os módulos no Crachá
        };

        setUser(loggedUser);
        localStorage.setItem('@OriginaGoias:user', JSON.stringify(loggedUser));
        toast.success(`Bem-vindo(a), ${loggedUser.name}!`);
        return true;
      } else {
        toast.error(response.message || "Login, senha ou empresa incorretos.");
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
    api.realizarLogout(); 
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