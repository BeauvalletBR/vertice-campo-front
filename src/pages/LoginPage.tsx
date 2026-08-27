import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { getDefaultAuthorizedRoute } from "@/lib/access";

export default function LoginPage() {
  const [loginInput, setLoginInput] = useState("");
  const [password, setPassword] = useState("");
  const [empresa, setEmpresa] = useState("1");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();

  const clearError = () => {
    if (errorMsg) setErrorMsg("");
  };

  const handleInputChange = (
    setter: React.Dispatch<React.SetStateAction<string>>,
    value: string,
  ) => {
    setter(value);
    clearError();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg("");

    const usuario = loginInput.trim();
    const senha = password.trim();

    if (!empresa) {
      setErrorMsg("Selecione a empresa.");
      return;
    }

    if (!usuario || !senha) {
      setErrorMsg("Informe o usuário e a senha.");
      return;
    }

    setIsLoading(true);

    try {
      const loggedUser = await login(usuario, senha, empresa);

      if (!loggedUser) {
        setErrorMsg("Usuário, senha ou empresa incorretos.");
        return;
      }

      const isMobile = window.innerWidth < 1024;
      const nextRoute = getDefaultAuthorizedRoute(loggedUser, {
        preferOperational: isMobile,
      });

      navigate(nextRoute || (isMobile ? "/campo" : "/dashboard"));
    } catch {
      setErrorMsg(
        "Não foi possível acessar o sistema. Tente novamente em instantes.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen w-full overflow-hidden bg-white">
      {/* Lado esquerdo: imagem institucional, oculta no mobile */}
      <section className="relative hidden min-h-screen w-1/2 overflow-hidden bg-[#102A43] lg:block">
        <img
          src="/imagem_login.png"
          alt="Fazenda e agronegócio"
          className="absolute inset-0 h-full w-full object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-[#102A43]/95 via-[#173D6E]/45 to-[#173D6E]/10" />

        <div className="absolute inset-x-0 bottom-0 p-10 xl:p-14">
          <div className="max-w-xl">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/70">
              Vértice Compra de Gado
            </p>

            <h2 className="mt-3 text-3xl font-extrabold leading-tight text-white xl:text-4xl">
              Gestão integrada para uma operação mais segura e eficiente.
            </h2>

            <p className="mt-4 max-w-lg text-sm font-medium leading-relaxed text-white/75">
              Acesse os módulos corporativos, acompanhe o planejamento e
              mantenha as informações da operação centralizadas.
            </p>
          </div>
        </div>
      </section>

      {/* Lado direito: formulário */}
      <section className="relative flex min-h-screen w-full flex-col bg-white lg:w-1/2">
        <div
          className="grid h-1.5 w-full shrink-0 grid-cols-[1.05fr_1fr_0.85fr]"
          aria-label="Cores institucionais Beauvallet"
        >
          <span className="bg-[#E30613]" />
          <span className="bg-[#173D6E]" />
          <span className="bg-[#0AB1D8]" />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10 lg:px-12 xl:px-20">
          <div className="w-full max-w-[420px]">
            <div className="mb-7 flex justify-center">
              <img
                src="/logo.png"
                alt="Beauvallet Brasil"
                className="h-20 w-auto object-contain sm:h-24"
              />
            </div>

            <div className="mb-7">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#E30613]">
                Bem-vindo ao Vértice - Compra de gado
              </p>

              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#173D6E] sm:text-[2rem]">
                Acesse sua conta
              </h1>

              <p className="mt-2 text-sm font-medium leading-relaxed text-[#718297]">
                Utilize suas credenciais corporativas para continuar.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label
                  htmlFor="empresa"
                  className="text-[11px] font-extrabold text-[#334E68]"
                >
                  Empresa
                </Label>

                <div className="relative">
                  <Building2
                    className={`pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 ${
                      errorMsg ? "text-[#E30613]" : "text-[#8797A8]"
                    }`}
                  />

                  <select
                    id="empresa"
                    value={empresa}
                    onChange={(event) =>
                      handleInputChange(setEmpresa, event.target.value)
                    }
                    disabled={isLoading}
                    required
                    className={`flex h-12 w-full appearance-none rounded-lg border bg-white pl-11 pr-10 text-sm font-semibold text-[#334E68] outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      errorMsg
                        ? "border-[#E9A2A8] bg-[#FFF8F8] focus:border-[#E30613] focus:ring-2 focus:ring-[#E30613]/15"
                        : "border-[#C9D6E2] hover:border-[#AEBFD0] focus:border-[#1B58A0] focus:ring-2 focus:ring-[#1B58A0]/15"
                    }`}
                  >
                    <option value="1">EMPRESA 1</option>
                    <option value="2">EMPRESA 2</option>
                  </select>

                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#8797A8]">
                    ▼
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="login"
                  className="text-[11px] font-extrabold text-[#334E68]"
                >
                  Usuário
                </Label>

                <div className="relative">
                  <UserRound
                    className={`pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 ${
                      errorMsg ? "text-[#E30613]" : "text-[#8797A8]"
                    }`}
                  />

                  <Input
                    id="login"
                    value={loginInput}
                    onChange={(event) =>
                      handleInputChange(
                        setLoginInput,
                        event.target.value.toUpperCase(),
                      )
                    }
                    placeholder="Digite seu usuário"
                    className={`h-12 rounded-lg bg-white pl-11 pr-4 text-sm font-semibold uppercase text-[#334E68] placeholder:normal-case placeholder:font-medium placeholder:text-[#A2AFBC] ${
                      errorMsg
                        ? "border-[#E9A2A8] bg-[#FFF8F8] focus-visible:border-[#E30613] focus-visible:ring-[#E30613]/15"
                        : "border-[#C9D6E2] hover:border-[#AEBFD0] focus-visible:border-[#1B58A0] focus-visible:ring-[#1B58A0]/15"
                    }`}
                    required
                    disabled={isLoading}
                    autoComplete="username"
                    autoCapitalize="characters"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-[11px] font-extrabold text-[#334E68]"
                >
                  Senha
                </Label>

                <div className="relative">
                  <LockKeyhole
                    className={`pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 ${
                      errorMsg ? "text-[#E30613]" : "text-[#8797A8]"
                    }`}
                  />

                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) =>
                      handleInputChange(setPassword, event.target.value)
                    }
                    placeholder="Digite sua senha"
                    className={`h-12 rounded-lg bg-white pl-11 pr-12 text-sm font-semibold text-[#334E68] placeholder:font-medium placeholder:text-[#A2AFBC] ${
                      errorMsg
                        ? "border-[#E9A2A8] bg-[#FFF8F8] focus-visible:border-[#E30613] focus-visible:ring-[#E30613]/15"
                        : "border-[#C9D6E2] hover:border-[#AEBFD0] focus-visible:border-[#1B58A0] focus-visible:ring-[#1B58A0]/15"
                    }`}
                    required
                    disabled={isLoading}
                    autoComplete="current-password"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#8797A8] transition-colors hover:bg-[#EEF4FA] hover:text-[#173D6E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B58A0]/30"
                    title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-[18px] w-[18px]" />
                    ) : (
                      <Eye className="h-[18px] w-[18px]" />
                    )}
                  </button>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-[10px] font-extrabold text-[#173D6E] transition-colors hover:text-[#1B58A0] hover:underline"
                    onClick={() =>
                      setErrorMsg(
                        "Para redefinir sua senha, entre em contato com a equipe de TI.",
                      )
                    }
                  >
                    Esqueci minha senha
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div
                  className="flex items-start gap-2.5 rounded-lg border border-[#F0B8BC] bg-[#FFF5F6] px-3.5 py-3 text-[#A51D29]"
                  role="alert"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-xs font-bold leading-relaxed">
                    {errorMsg}
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="mt-2 h-12 w-full gap-2 rounded-lg bg-[#173D6E] text-sm font-extrabold text-white shadow-[0_7px_18px_rgba(23,61,110,0.20)] transition-all hover:bg-[#1B58A0] active:scale-[0.99]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Autenticando...
                  </>
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-5 text-center">
              <p className="text-xs font-medium text-[#9AA8B6]">
                Problemas de acesso?{" "}
                <span className="font-extrabold text-[#173D6E]">
                  Entre em contato com a TI
                </span>
              </p>
            </div>
          </div>
        </div>

        <footer className="px-5 pb-5 text-center">
          <p className="text-[10px] font-medium text-[#A2AFBC]">
            © {new Date().getFullYear()} Beauvallet Brasil. Todos os direitos
            reservados.
          </p>
        </footer>
      </section>
    </main>
  );
}

