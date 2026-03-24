import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { LogIn, Loader2, UserSquare2, LockKeyhole, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [loginInput, setLoginInput] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(""); // <-- Novo estado para controlar o erro
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(""); // Limpa o erro antes de tentar novamente

    if (loginInput.trim() && password.trim()) {
      setIsLoading(true);
      
      try {
        const success = await login(loginInput.trim(), password.trim());
        
        // Se a função login retornar false, disparamos a mensagem clássica de erro
        if (!success) {
          setErrorMsg("Usuário ou senha incorretos.");
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Função para limpar o vermelho da tela assim que o usuário voltar a digitar
  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
    setter(value);
    if (errorMsg) setErrorMsg("");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      {/* Detalhe visual de fundo */}
      <div className="absolute top-0 w-full h-[40vh] bg-primary/5 rounded-b-[100%] pointer-events-none" />

      <Card className="w-full max-w-md shadow-2xl border-t-4 border-t-primary relative z-10 border-x-0 border-b-0 sm:border-x sm:border-b sm:rounded-xl">
        <CardHeader className="text-center space-y-3 pb-6 pt-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto shadow-inner">
            <LogIn className="w-7 h-7 text-primary ml-1" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-3xl font-black text-slate-800 tracking-tight">
              Vértice <span className="text-primary">Campo</span>
            </CardTitle>
            <p className="text-sm font-medium text-muted-foreground">
              Acesso Interno.
            </p>
          </div>
        </CardHeader>
        
        <CardContent className="pb-8 px-6 sm:px-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            <div className="space-y-2">
              <Label htmlFor="login" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Login</Label>
              <div className="relative">
                <UserSquare2 className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${errorMsg ? 'text-red-400' : 'text-slate-400'}`} />
                <Input 
                  id="login" 
                  value={loginInput} 
                  onChange={(e) => handleInputChange(setLoginInput, e.target.value.toUpperCase())} 
                  placeholder="Digite seu usuário..." 
                  className={`pl-10 h-12 bg-slate-50/50 uppercase font-bold text-slate-700 transition-all ${errorMsg ? 'border-red-400 focus-visible:ring-red-400 bg-red-50/30' : 'border-slate-200 focus-visible:ring-primary'}`} 
                  required 
                  disabled={isLoading}
                  autoComplete="username"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Senha</Label>
              <div className="relative">
                <LockKeyhole className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${errorMsg ? 'text-red-400' : 'text-slate-400'}`} />
                <Input 
                  id="password" 
                  type="password" 
                  value={password} 
                  onChange={(e) => handleInputChange(setPassword, e.target.value)} 
                  placeholder="Sua senha secreta..." 
                  className={`pl-10 h-12 bg-slate-50/50 font-semibold text-slate-700 transition-all ${errorMsg ? 'border-red-400 focus-visible:ring-red-400 bg-red-50/30' : 'border-slate-200 focus-visible:ring-primary'}`} 
                  required 
                  disabled={isLoading}
                  autoComplete="current-password"
                />
              </div>
              
              {/* ALERTA CLÁSSICO DE ERRO VERMELHINHO AQUI */}
              {errorMsg && (
                <div className="flex items-center gap-1.5 mt-2 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                  <p className="text-xs font-bold text-red-500">{errorMsg}</p>
                </div>
              )}
            </div>

            <Button 
              type="submit" 
              variant="action" 
              size="xl" 
              className="w-full h-14 text-base font-bold tracking-wide mt-8 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
              disabled={isLoading}
            >
              {isLoading ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> AUTENTICANDO...</>
              ) : (
                "ENTRAR NO SISTEMA"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <div className="mt-8 text-center relative z-10">
        <p className="text-xs text-slate-400 font-medium">
          &copy; {new Date().getFullYear()} Beauvallet — Gestão de Originação
        </p>
      </div>
      
    </div>
  );
}