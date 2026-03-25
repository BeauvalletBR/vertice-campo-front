# COMPONENTS_AND_STYLE.md

# Guia de UI e Componentes

## 1. Filosofia de UI do projeto

O Bovino Pro combina:

- **shadcn/ui** como base de componentes reutilizáveis;
- **Radix UI** para acessibilidade e primitives;
- **Tailwind CSS** para composição visual rápida;
- **tokens CSS customizados** em `src/index.css` para identidade visual.

O resultado atual é uma interface com foco em:
- legibilidade operacional;
- contraste forte;
- uso frequente de cards;
- tabelas e filtros;
- visual corporativo com destaque para azul primário e vermelho/accent.

## 2. Design tokens e tema

Os tokens principais estão em `src/index.css`:

```css
:root {
  --background: 210 33% 99%;
  --foreground: 225 71% 10%;
  --primary: 228 100% 29%;
  --primary-foreground: 0 0% 100%;
  --accent: 356 83% 55%;
  --accent-foreground: 0 0% 100%;
  --border: 214 20% 90%;
  --radius: 0.5rem;
  --sidebar-background: 228 100% 29%;
  --sidebar-foreground: 0 0% 100%;
}
```

### Leitura prática desses tokens
- **`primary`**: identidade principal da marca/app.
- **`accent`**: ação e destaque.
- **`sidebar-*`**: paleta dedicada da navegação lateral.
- **`radius`**: controla arredondamento padrão.

## 3. shadcn/ui no projeto

A base visual está concentrada em `src/components/ui`.

Essa pasta contém componentes como:

- `button.tsx`
- `card.tsx`
- `input.tsx`
- `label.tsx`
- `table.tsx`
- `dialog.tsx`
- `sidebar.tsx`
- `tooltip.tsx`
- `form.tsx`
- `sonner.tsx`

### Papel dessa pasta
Ela funciona como a “camada de primitives” do app. Em vez de construir botões, inputs, cards e sidebars do zero em cada tela, as páginas importam essas peças e compõem as features.

## 4. Exemplo: Button padronizado

O botão do projeto usa `class-variance-authority` para controlar variantes e tamanhos.

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ...",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        action: "bg-accent text-accent-foreground hover:bg-accent/90 font-bold shadow-lg",
        field: "bg-primary text-primary-foreground hover:bg-primary/90 font-bold",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        xl: "h-16 rounded-lg px-8 text-lg",
        xxl: "h-20 rounded-lg px-8 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
```

### O que isso traz
- consistência visual;
- reuso;
- tipagem das props;
- previsibilidade de variantes.

## 5. Padrão de composição atual

As telas normalmente combinam:

- `Card` para blocos visuais;
- `Input` + `Label` para filtros e campos;
- `Table` para listagens;
- `Button` para ações;
- ícones do `lucide-react` para semântica visual.

### Exemplo em `LoginPage.tsx`

```tsx
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
    />
  </div>
</div>
```

### Leitura do padrão
- `Label` pequeno, em caixa alta;
- `Input` com ícone absoluto;
- classes Tailwind montadas inline;
- regra visual de erro no próprio campo.

![[Inserir Imagem aqui: Exemplo de Formulário Padrão do Sistema]](docs/images/form-example.png)

## 6. Tailwind CSS no projeto

O Tailwind é a principal ferramenta de layout e estilo.

### Características observadas
- uso intenso de utility classes inline;
- grids responsivos com `grid-cols-*`;
- espaçamento consistente com `p-*`, `gap-*`, `space-y-*`;
- variações de cor baseadas em tokens (`bg-primary`, `text-muted-foreground`);
- responsividade com `sm:`, `md:`, `lg:`.

### Exemplo em cards do dashboard

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  ...
</div>
```

### Exemplo em mapa responsivo da visita

```tsx
<div className="order-1 lg:order-2 h-[400px] lg:h-[calc(100vh-6rem)] lg:sticky lg:top-8 w-full rounded-2xl overflow-hidden border-2 border-primary/20 shadow-xl z-0">
```

## 7. Regras recomendadas para criar novos componentes

## 7.1. Onde colocar

### Colocar em `src/components/ui`
Quando for:
- genérico;
- reutilizável;
- desacoplado da regra de negócio;
- próximo do ecossistema shadcn/Radix.

Exemplos:
- botão customizado;
- select reutilizável;
- badge;
- card de métrica genérico.

### Colocar em `src/components`
Quando for:
- componente de domínio;
- ligado a uma feature do produto;
- dependente de dados ou regra de negócio.

Exemplos:
- `Dashboard`
- `FieldVisit`
- `ProtectedRoute`
- `AppSidebar`

### Criar subpastas por feature no futuro
Para escalar melhor, faz sentido evoluir para algo como:

```text
src/features/
  auth/
  agendamento/
  visitas/
  campo/
  dashboard/
```

## 7.2. Como tipar

Sempre tipar props com TypeScript explícito.

### Exemplo recomendado

```ts
interface MetricCardProps {
  title: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
}
```

### Princípios
- evitar `any`;
- preferir unions quando possível;
- reaproveitar interfaces da camada de dados;
- exportar tipos quando houver reuso entre arquivos.

## 7.3. Como montar classes
O projeto já usa `cn()` em `src/lib/utils.ts`:

```ts
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Use `cn()` quando houver:
- condição;
- composição dinâmica;
- merge de classes vindas de props.

## 8. Componentes de navegação

O app usa um wrapper próprio de `NavLink`:

```tsx
const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, ...props }, ref) => {
    return (
      <RouterNavLink
        ref={ref}
        to={to}
        className={({ isActive, isPending }) =>
          cn(className, isActive && activeClassName, isPending && pendingClassName)
        }
        {...props}
      />
    );
  },
);
```

### Vantagem
Isso simplifica a semântica de link ativo no sidebar e preserva uma API parecida com routers anteriores.

## 9. Formulários: estado atual

## 9.1. O que existe pronto
O projeto possui dependências e infraestrutura para:
- `react-hook-form`
- `zod`
- `@hookform/resolvers`
- wrapper UI em `src/components/ui/form.tsx`

Exemplo real do wrapper:

```tsx
const Form = FormProvider;

const FormField = <TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
};
```

## 9.2. Como os formulários estão sendo feitos hoje
Nas telas atuais, predominam campos controlados com `useState`, por exemplo em `LoginPage.tsx`:

```tsx
const [loginInput, setLoginInput] = useState("");
const [password, setPassword] = useState("");
```

E em `FieldVisit.tsx`, o formulário inteiro é mantido em um objeto grande:

```tsx
const emptyForm = (today: string, userName: string): FormData => ({
  id_agendamento: "",
  cod_produtor: "",
  nome: "",
  ie: "",
  propriedade: "",
  ...
});
```

### Consequência
Esse modelo funciona, mas tende a:
- crescer demais;
- misturar validação com UI;
- dificultar reuso;
- aumentar chance de regressão.

## 10. Padrão recomendado para novos formulários

Mesmo que as telas atuais ainda não sigam isso, o padrão ideal dentro deste projeto é:

1. definir schema com `zod`;
2. ligar ao `react-hook-form` com `zodResolver`;
3. usar os componentes de `src/components/ui/form.tsx`;
4. exibir mensagens de erro com `FormMessage`.

### Exemplo de direção arquitetural
- schema em `src/features/<feature>/schema.ts`
- componente em `src/features/<feature>/components/<Form>.tsx`
- submit desacoplado via service ou mutation.

## 11. Notificações e feedback visual

O projeto usa **Sonner** como solução principal de toast.

Exemplo:

```tsx
toast.success("PDF gerado com sucesso!");
toast.error("Erro ao gerar o PDF.");
toast.info("Você saiu do sistema.");
```

O provider visual fica em:

```tsx
<Sonner />
```

E o componente customizado define a aparência base:

```tsx
toastOptions={{
  classNames: {
    toast:
      "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
  },
}}
```

## 12. Boas práticas para evolução da UI

### Manter
- reuso de primitives shadcn/ui;
- uso de `Button`, `Card`, `Input`, `Table`;
- design tokens centralizados;
- sidebar controlado por papel.

### Melhorar
- reduzir classes inline em componentes grandes;
- extrair blocos repetidos de formulário;
- centralizar padrões de label/input/error;
- diminuir acoplamento entre lógica e renderização.

## 13. Checklist para novos componentes

Antes de criar um componente novo, validar:

- ele é genérico ou de domínio?
- precisa ficar em `ui/` ou em `components/`?
- está totalmente tipado?
- recebe apenas props necessárias?
- usa `cn()` quando há variação de classes?
- reaproveita primitives já existentes?
- está preparado para loading, erro e estado vazio?
