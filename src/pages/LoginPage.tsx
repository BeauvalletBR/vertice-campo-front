import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, UserSquare2, LockKeyhole, AlertCircle, Building2 } from "lucide-react";

export default function LoginPage() {
  const [loginInput, setLoginInput] = useState("");
  const [password, setPassword] = useState("");
  const [empresa, setEmpresa] = useState("1"); 
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (loginInput.trim() && password.trim() && empresa) {
      setIsLoading(true);
      
      try {
        const success = await login(loginInput.trim(), password.trim(), empresa);
        
        if (!success) {
          setErrorMsg("Usuário, senha ou empresa incorretos.");
        } else {
          const isMobile = window.innerWidth < 1024;
          
          if (isMobile) {
            navigate("/campo"); // Vai direto pro módulo do campo no celular
          } else {
            navigate("/dashboard"); // Vai pro dashboard no computador
          }
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
    setter(value);
    if (errorMsg) setErrorMsg("");
  };

  return (
    <div className="min-h-screen w-full flex bg-white">
      
      {/* ==========================================
          LADO ESQUERDO: FORMULÁRIO DE LOGIN
          ========================================== */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 relative bg-white z-10 shadow-2xl">
        
        <div className="w-full max-w-md space-y-10">
          
          <div className="flex flex-col items-center text-center space-y-6">
            <img 
              src="/logo.png" 
              alt="Logo Empresa" 
              className="h-20 object-contain" 
            />
            
            <div className="space-y-1.5">
              <h1 className="text-4xl font-black tracking-tight text-slate-800">
                Vértice <span className="text-primary">Campo</span>
              </h1>
              <p className="text-sm font-medium text-slate-500">
                Bem-vindo de volta! Insira suas credenciais para acessar.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="space-y-2.5">
              <Label htmlFor="empresa" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Empresa</Label>
              <div className="relative">
                <Building2 className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${errorMsg ? 'text-red-400' : 'text-slate-400'}`} />
                <select
                  id="empresa"
                  value={empresa}
                  onChange={(e) => handleInputChange(setEmpresa, e.target.value)}
                  className={`flex w-full rounded-lg border pl-11 h-12 bg-slate-50 font-bold text-slate-700 transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 ${errorMsg ? 'border-red-400 focus-visible:ring-red-400 bg-red-50/30' : 'border-slate-200 focus-visible:ring-primary hover:border-slate-300'}`}
                  required
                  disabled={isLoading}
                >
                  <option value="1">EMPRESA 1</option>
                  <option value="2">EMPRESA 2</option>
                </select>
              </div>
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="login" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Usuário</Label>
              <div className="relative">
                <UserSquare2 className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${errorMsg ? 'text-red-400' : 'text-slate-400'}`} />
                <Input 
                  id="login" 
                  value={loginInput} 
                  onChange={(e) => handleInputChange(setLoginInput, e.target.value.toUpperCase())} 
                  placeholder="Digite seu usuário..." 
                  className={`pl-11 h-12 bg-slate-50 rounded-lg uppercase font-bold text-slate-700 transition-all ${errorMsg ? 'border-red-400 focus-visible:ring-red-400 bg-red-50/30' : 'border-slate-200 focus-visible:ring-primary hover:border-slate-300'}`} 
                  required 
                  disabled={isLoading}
                  autoComplete="username"
                />
              </div>
            </div>
            
            <div className="space-y-2.5">
              <Label htmlFor="password" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Senha</Label>
              <div className="relative">
                <LockKeyhole className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${errorMsg ? 'text-red-400' : 'text-slate-400'}`} />
                <Input 
                  id="password" 
                  type="password" 
                  value={password} 
                  onChange={(e) => handleInputChange(setPassword, e.target.value)} 
                  placeholder="••••••••" 
                  className={`pl-11 h-12 bg-slate-50 rounded-lg font-semibold text-slate-700 transition-all ${errorMsg ? 'border-red-400 focus-visible:ring-red-400 bg-red-50/30' : 'border-slate-200 focus-visible:ring-primary hover:border-slate-300'}`} 
                  required 
                  disabled={isLoading}
                  autoComplete="current-password"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 mt-2 p-3 bg-red-50 rounded-lg border border-red-100 animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <p className="text-xs font-bold text-red-600">{errorMsg}</p>
              </div>
            )}

            <Button 
              type="submit" 
              size="xl" 
              className="w-full h-14 rounded-lg text-base font-bold tracking-wide mt-8 shadow-lg shadow-primary/25 transition-all active:scale-[0.98] hover:bg-primary/90"
              disabled={isLoading}
            >
              {isLoading ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> AUTENTICANDO...</>
              ) : (
                "ENTRAR NO SISTEMA"
              )}
            </Button>
          </form>

          <div className="pt-8 text-center">
            <p className="text-xs text-slate-400 font-medium">
              &copy; {new Date().getFullYear()} Beauvallet — Vértice <strong>Campo</strong>
            </p>
          </div>

        </div>
      </div>

      {/* ==========================================
          LADO DIREITO: IMAGEM (Oculto no Mobile)
          ========================================== */}
      {/* 👇 Repare no "hidden lg:flex" aqui. Ele já oculta a imagem no celular sozinho! 👇 */}
      <div className="hidden lg:flex w-1/2 relative bg-slate-900 overflow-hidden items-center justify-center">
        <img
          src="/imagem_login.png"
          alt="Fazenda e Agronegócio"
          className="absolute inset-0 w-full h-full object-cover opacity-95"
        />
        
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-slate-900/10" />
      </div>
      
    </div>
  );
}