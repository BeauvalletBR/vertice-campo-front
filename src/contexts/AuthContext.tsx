import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export interface User {
  id: string | number;
  name: string;
  login: string;
  role: "ADMIN" | "COMPRADOR";
  empresa?: string;
  modulos?: string[];
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
  
  //👇 ESTADO DO MODAL DE EXPIRAÇÃO 👇
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('@OriginaGoias:user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    //👇 OUVINTE DO EVENTO DE EXPIRAÇÃO DE SESSÃO 👇
    const handleSessaoExpirada = () => {
      setIsSessionExpired(true);
    };

    window.addEventListener('sessao-expirada', handleSessaoExpirada);

    return () => {
      window.removeEventListener('sessao-expirada', handleSessaoExpirada);
    };
  }, []);

  const login = async (loginInput: string, senhaInput: string, empresa: string): Promise<boolean> => {
    try {
      const response = await api.realizarLogin(loginInput, senhaInput, empresa);
      
      if (response.success && response.user) {
        const loggedUser: User = {
          id: response.user.id,
          name: response.user.name || response.user.login,
          login: response.user.login,
          role: response.user.role || "COMPRADOR",
          empresa: empresa, 
          modulos: response.user.modulos || [] 
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

  const handleForcarLogin = () => {
    setIsSessionExpired(false);
    logout(); 
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}

      {/*👇 MODAL GIGANTE DE BLOQUEIO👇*/}
      {isSessionExpired && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <Card className="w-full max-w-sm shadow-2xl border-t-4 border-t-red-600 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-white p-6 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black text-slate-800 mb-2">Sessão Expirada</h2>
              <p className="text-sm text-slate-500 font-medium mb-6">
                Por motivos de segurança, seu acesso expirou ou é inválido. Por favor, faça login novamente para continuar.
              </p>
              <Button 
                onClick={handleForcarLogin} 
                className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-bold text-base shadow-md"
              >
                LOGAR NOVAMENTE
              </Button>
            </div>
          </Card>
        </div>
      )}
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