import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const { login } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && email.trim()) {
      login(name.trim(), email.trim());
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <LogIn className="w-7 h-7 text-primary" />
          </div>
          <CardTitle className="text-xl font-bold text-primary">
            Originação Goiás
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Entre com seu Login e Senha para acessar o sistema.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold text-muted-foreground uppercase">Login</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu login" className="h-12" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase">Senha</Label>
              <Input id="password" type="password" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Sua senha" className="h-12" required />
            </div>
            <Button type="submit" variant="action" size="xl" className="w-full mt-2">
              ENTRAR
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
