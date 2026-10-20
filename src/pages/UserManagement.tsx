import { useEffect, useState } from "react";
import {
  AppWindow,
  Building2,
  KeyRound,
  Layers3,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type AdminApplication,
  type AdminCatalog,
  type AdminModule,
  type AdminSystem,
  type AdminUser,
  userManagementApi,
} from "@/services/user-management";

const EMPTY_CATALOG: AdminCatalog = {
  sistemas: [],
  modulos: [],
  aplicacoes: [],
  empresas: [],
};

const systemInitial = { sistema: "", descricao: "", siglasistema: "", utilizaptf: "N" };
const moduleInitial = {
  sistema: "",
  modulo: "",
  descricao: "",
  siglamodulo: "",
  tipoacesso: "",
  versao: "",
  origem: "VERTICE",
  ordem: "",
};
const applicationInitial = {
  codaplicacao: "",
  sistema: "",
  modulo: "",
  descricao: "",
  tipoacesso: "",
  origem: "VERTICE",
};

const permissionKey = (company: number, system: string, module: string) =>
  `${company}|${system}|${module}`;

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Não foi possível concluir a operação.";

export default function UserManagement() {
  const [catalog, setCatalog] = useState<AdminCatalog>(EMPTY_CATALOG);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [selectedCompany, setSelectedCompany] = useState<number>(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erpSearchOpen, setErpSearchOpen] = useState(false);
  const [erpSearch, setErpSearch] = useState("");
  const [erpUsers, setErpUsers] = useState<AdminUser[]>([]);
  const [searchingErp, setSearchingErp] = useState(false);

  const [systemForm, setSystemForm] = useState(systemInitial);
  const [editingSystem, setEditingSystem] = useState<string | null>(null);
  const [moduleForm, setModuleForm] = useState(moduleInitial);
  const [editingModule, setEditingModule] = useState<{ sistema: string; modulo: string } | null>(null);
  const [applicationForm, setApplicationForm] = useState(applicationInitial);
  const [editingApplication, setEditingApplication] = useState<number | null>(null);

  const loadCatalog = async () => {
    const data = await userManagementApi.getCatalog();
    setCatalog(data);
    setSelectedCompany((current) => current || Number(data.empresas[0]?.NROEMPRESA || 0));
  };

  const loadUsers = async (term = "") => {
    const data = await userManagementApi.getUsers(term, true);
    setUsers(data);
  };

  const searchErpUsers = async () => {
    const term = erpSearch.trim();
    if (term.length < 2) {
      toast.info("Digite pelo menos 2 caracteres para pesquisar no ERP.");
      return;
    }
    setSearchingErp(true);
    try {
      setErpUsers(await userManagementApi.getUsers(term, false));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSearchingErp(false);
    }
  };

  const refresh = async () => {
    setLoading(true);
    try {
      await Promise.all([loadCatalog(), loadUsers(search)]);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const selectUser = async (user: AdminUser) => {
    setSelectedUser(user);
    setSaving(true);
    try {
      const data = await userManagementApi.getPermissions(user.SEQUSUARIO);
      setPermissions(
        new Set(
          data
            .filter((item) => item.PERMISSAO === "S")
            .map((item) => permissionKey(item.NROEMPRESA, item.SISTEMA, item.MODULO)),
        ),
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const selectErpUser = async (user: AdminUser) => {
    await selectUser(user);
    setErpSearchOpen(false);
    setErpSearch("");
    setErpUsers([]);
  };

  const togglePermission = (system: string, module: string, checked: boolean) => {
    const key = permissionKey(selectedCompany, system, module);
    setPermissions((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const savePermissions = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const payload = Array.from(permissions).map((key) => {
        const [nroempresa, sistema, modulo] = key.split("|");
        return { nroempresa: Number(nroempresa), sistema, modulo };
      });
      const result = await userManagementApi.savePermissions(selectedUser.SEQUSUARIO, payload);
      toast.success(result.message);
      await loadUsers(search);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const submitSystem = async () => {
    setSaving(true);
    try {
      if (editingSystem) await userManagementApi.updateSystem(editingSystem, systemForm);
      else await userManagementApi.createSystem(systemForm);
      toast.success(editingSystem ? "Sistema atualizado." : "Sistema criado.");
      setSystemForm(systemInitial);
      setEditingSystem(null);
      await loadCatalog();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const editSystem = (system: AdminSystem) => {
    setEditingSystem(system.SISTEMA);
    setSystemForm({
      sistema: system.SISTEMA,
      descricao: system.DESCRICAO,
      siglasistema: system.SIGLASISTEMA,
      utilizaptf: system.UTILIZAPTF || "N",
    });
  };

  const deleteSystem = async (system: string) => {
    if (!window.confirm(`Excluir o sistema ${system}? Essa ação não pode ser desfeita.`)) return;
    try {
      await userManagementApi.deleteSystem(system);
      toast.success("Sistema excluído.");
      await loadCatalog();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const submitModule = async () => {
    setSaving(true);
    const payload = { ...moduleForm, ordem: moduleForm.ordem ? Number(moduleForm.ordem) : null };
    try {
      if (editingModule) {
        await userManagementApi.updateModule(editingModule.sistema, editingModule.modulo, payload);
      } else await userManagementApi.createModule(payload);
      toast.success(editingModule ? "Módulo atualizado." : "Módulo criado.");
      setModuleForm(moduleInitial);
      setEditingModule(null);
      await loadCatalog();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const editModule = (module: AdminModule) => {
    setEditingModule({ sistema: module.SISTEMA, modulo: module.MODULO });
    setModuleForm({
      sistema: module.SISTEMA,
      modulo: module.MODULO,
      descricao: module.DESCRICAO,
      siglamodulo: module.SIGLAMODULO,
      tipoacesso: module.TIPOACESSO || "",
      versao: module.VERSAO || "",
      origem: module.ORIGEM || "",
      ordem: module.ORDEM == null ? "" : String(module.ORDEM),
    });
  };

  const deleteModule = async (module: AdminModule) => {
    if (!window.confirm(`Excluir o módulo ${module.SISTEMA}/${module.MODULO}?`)) return;
    try {
      await userManagementApi.deleteModule(module.SISTEMA, module.MODULO);
      toast.success("Módulo excluído.");
      await loadCatalog();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const submitApplication = async () => {
    setSaving(true);
    try {
      if (editingApplication) {
        await userManagementApi.updateApplication(editingApplication, applicationForm);
      } else await userManagementApi.createApplication(applicationForm);
      toast.success(editingApplication ? "Aplicação atualizada." : "Aplicação criada.");
      setApplicationForm(applicationInitial);
      setEditingApplication(null);
      await loadCatalog();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const editApplication = (application: AdminApplication) => {
    setEditingApplication(application.SEQAPLICACAO);
    setApplicationForm({
      codaplicacao: application.CODAPLICACAO,
      sistema: application.SISTEMA,
      modulo: application.MODULO,
      descricao: application.DESCRICAO,
      tipoacesso: application.TIPOACESSO || "",
      origem: application.ORIGEM || "",
    });
  };

  const deleteApplication = async (application: AdminApplication) => {
    if (!window.confirm(`Excluir a aplicação ${application.CODAPLICACAO}?`)) return;
    try {
      await userManagementApi.deleteApplication(application.SEQAPLICACAO);
      toast.success("Aplicação excluída.");
      await loadCatalog();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const modulesForApplication = catalog.modulos.filter(
    (module) => module.SISTEMA === applicationForm.sistema,
  );
  const grantedModules = catalog.modulos.filter((module) =>
    permissions.has(permissionKey(selectedCompany, module.SISTEMA, module.MODULO)),
  );

  return (
    <div className="min-h-full bg-[#F4F7FA] p-3 sm:p-5 lg:p-7">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="overflow-hidden rounded-2xl border border-[#D4DFE9] bg-white shadow-[0_8px_24px_rgba(23,61,110,0.07)]">
          <div className="h-1.5 bg-[linear-gradient(90deg,#E30613_0_32%,#1B58A0_32%_72%,#0AB1D8_72%)]" />
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#173D6E] text-white">
                <UserCog className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#D96B1A]">Vértice Main</p>
                <h1 className="text-2xl font-black tracking-tight text-[#173D6E]">Controle de usuários</h1>
                <p className="text-xs font-medium text-[#667B90]">Acessos por empresa, sistemas, módulos e aplicações.</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => void refresh()} disabled={loading} className="border-[#B9CBDD] text-[#173D6E]">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>
        </header>

        <Tabs defaultValue="usuarios" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-[#E7EEF5] p-1 sm:grid-cols-5">
            <TabsTrigger value="usuarios"><KeyRound className="mr-2 h-4 w-4" />Usuários</TabsTrigger>
            <TabsTrigger value="sistemas"><ShieldCheck className="mr-2 h-4 w-4" />Sistemas</TabsTrigger>
            <TabsTrigger value="modulos"><Layers3 className="mr-2 h-4 w-4" />Módulos</TabsTrigger>
            <TabsTrigger value="aplicacoes"><AppWindow className="mr-2 h-4 w-4" />Aplicações</TabsTrigger>
            <TabsTrigger value="empresas"><Building2 className="mr-2 h-4 w-4" />Empresas</TabsTrigger>
          </TabsList>

          <TabsContent value="usuarios">
            <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
              <Card className="border-[#D4DFE9]">
                <CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><div><CardTitle className="text-base text-[#173D6E]">Usuários cadastrados</CardTitle><p className="mt-1 text-xs text-[#6B7F92]">Pessoas que já possuem ao menos um módulo.</p></div><Badge variant="secondary">{users.length}</Badge></div></CardHeader>
                <CardContent className="space-y-3">
                  <Button type="button" variant={erpSearchOpen ? "secondary" : "outline"} className="w-full border-[#9DB7CF] text-[#173D6E]" onClick={() => { setErpSearchOpen((current) => !current); setErpUsers([]); }}><UserPlus className="mr-2 h-4 w-4" />{erpSearchOpen ? "Fechar busca do ERP" : "Adicionar usuário do ERP"}</Button>
                  {erpSearchOpen && <div className="space-y-2 rounded-xl border border-[#BFD0DF] bg-[#F4F8FB] p-3">
                    <div><p className="text-xs font-black text-[#173D6E]">Pesquisar no ERP</p><p className="text-[10px] text-[#6B7F92]">Localize por nome, login ou e-mail para conceder o primeiro acesso.</p></div>
                    <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void searchErpUsers(); }}>
                      <Input value={erpSearch} onChange={(event) => setErpSearch(event.target.value)} placeholder="Usuário do ERP" autoFocus />
                      <Button type="submit" size="icon" aria-label="Pesquisar usuário no ERP" disabled={searchingErp}><Search className={`h-4 w-4 ${searchingErp ? "animate-pulse" : ""}`} /></Button>
                    </form>
                    {erpUsers.length > 0 && <div className="max-h-60 space-y-1 overflow-y-auto pr-1">{erpUsers.map((user) => <button key={`erp-${user.SEQUSUARIO}`} type="button" onClick={() => void selectErpUser(user)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#D5E0E9] bg-white p-2.5 text-left hover:border-[#1B58A0] hover:bg-[#EDF5FD]"><span className="min-w-0"><strong className="block truncate text-xs text-[#173D6E]">{user.NOME}</strong><small className="block truncate text-[10px] text-[#6B7F92]">{user.CODUSUARIO}{user.EMAIL ? ` · ${user.EMAIL}` : ""}</small></span><Badge variant={user.QTD_PERMISSOES > 0 ? "secondary" : "outline"}>{user.QTD_PERMISSOES > 0 ? "Cadastrado" : "Adicionar"}</Badge></button>)}</div>}
                    {!searchingErp && erpSearch.trim().length >= 2 && erpUsers.length === 0 && <p className="rounded-lg border border-dashed border-[#C9D6E2] p-3 text-center text-[10px] font-semibold text-[#6B7F92]">Nenhum usuário encontrado no ERP.</p>}
                  </div>}
                  <div className="border-t border-[#E0E8EF] pt-3"><p className="mb-2 text-[10px] font-black uppercase tracking-wider text-[#60758A]">Filtrar cadastrados</p>
                  <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void loadUsers(search); }}>
                    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, login ou e-mail" />
                    <Button type="submit" size="icon" aria-label="Pesquisar"><Search className="h-4 w-4" /></Button>
                  </form>
                  </div>
                  <div className="max-h-[600px] space-y-2 overflow-y-auto pr-1">
                    {users.map((user) => (
                      <button key={user.SEQUSUARIO} type="button" onClick={() => void selectUser(user)} className={`w-full rounded-xl border p-3 text-left transition ${selectedUser?.SEQUSUARIO === user.SEQUSUARIO ? "border-[#1B58A0] bg-[#EDF5FD] ring-1 ring-[#1B58A0]" : "border-[#DCE5ED] bg-white hover:border-[#8EABC7]"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0"><p className="truncate text-sm font-black text-[#173D6E]">{user.NOME}</p><p className="truncate text-xs font-semibold text-[#6B7F92]">{user.CODUSUARIO}</p></div>
                          <Badge variant="secondary">{user.QTD_PERMISSOES || 0}</Badge>
                        </div>
                      </button>
                    ))}
                    {!loading && users.length === 0 && <p className="rounded-xl border border-dashed border-[#C9D6E2] bg-[#F8FAFC] p-5 text-center text-xs font-semibold text-[#60758A]">Nenhum usuário com módulos cadastrados.</p>}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[#D4DFE9]">
                <CardHeader className="border-b border-[#E0E8EF] pb-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div><CardTitle className="text-base text-[#173D6E]">Permissões por empresa</CardTitle><p className="mt-1 text-xs text-[#6B7F92]">{selectedUser ? `${selectedUser.NOME} • ${selectedUser.CODUSUARIO}` : "Selecione um usuário ao lado."}</p></div>
                    {selectedUser && <Button onClick={() => void savePermissions()} disabled={saving}><Save className="mr-2 h-4 w-4" />Salvar acessos</Button>}
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-5">
                  {!selectedUser ? <EmptyState text="Escolha um usuário para configurar os acessos." /> : (
                    <div className="space-y-4">
                      <div className="max-w-md space-y-2"><Label>Empresa</Label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={selectedCompany} onChange={(event) => setSelectedCompany(Number(event.target.value))}>{catalog.empresas.map((company) => <option key={company.NROEMPRESA} value={company.NROEMPRESA}>{company.NROEMPRESA} - {company.NOMEREDUZIDO || company.FANTASIA || company.RAZAOSOCIAL}</option>)}</select></div>
                      <div className="rounded-xl border border-[#BFD0DF] bg-[#F4F8FB] p-4">
                        <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-sm font-black text-[#173D6E]">Módulos com acesso</p><p className="text-[10px] text-[#6B7F92]">Liberações atuais na empresa selecionada.</p></div><Badge className="bg-[#173D6E]">{grantedModules.length}</Badge></div>
                        {grantedModules.length > 0 ? <div className="flex flex-wrap gap-2">{grantedModules.map((module) => <Badge key={`granted-${module.SISTEMA}-${module.MODULO}`} variant="outline" className="border-[#9AB6CF] bg-white px-2.5 py-1 text-[#173D6E]"><span className="font-black">{module.DESCRICAO}</span><span className="ml-1 text-[9px] text-[#71869A]">{module.SISTEMA}/{module.MODULO}</span></Badge>)}</div> : <p className="rounded-lg border border-dashed border-[#C9D6E2] bg-white p-3 text-center text-xs font-semibold text-[#6B7F92]">Nenhum módulo liberado nesta empresa.</p>}
                      </div>
                      <div className="grid gap-3 xl:grid-cols-2">
                        {catalog.sistemas.map((system) => {
                          const modules = catalog.modulos.filter((module) => module.SISTEMA === system.SISTEMA);
                          return <div key={system.SISTEMA} className="rounded-xl border border-[#D8E3EC] bg-[#F9FBFD] p-4"><div className="mb-3"><p className="text-sm font-black text-[#173D6E]">{system.DESCRICAO}</p><p className="text-[10px] font-bold uppercase tracking-wider text-[#7A8DA0]">{system.SISTEMA}</p></div><div className="grid gap-2 sm:grid-cols-2">{modules.map((module) => { const key = permissionKey(selectedCompany, module.SISTEMA, module.MODULO); return <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#DFE7EE] bg-white p-2.5 text-xs font-bold text-[#36536F]"><Checkbox checked={permissions.has(key)} onCheckedChange={(checked) => togglePermission(module.SISTEMA, module.MODULO, checked === true)} /><span>{module.DESCRICAO}</span></label>; })}</div></div>;
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sistemas">
            <ManagementLayout form={<><FormField label="Código" value={systemForm.sistema} disabled={Boolean(editingSystem)} onChange={(value) => setSystemForm({ ...systemForm, sistema: value.toUpperCase() })} /><FormField label="Descrição" value={systemForm.descricao} onChange={(value) => setSystemForm({ ...systemForm, descricao: value })} /><FormField label="Sigla" value={systemForm.siglasistema} onChange={(value) => setSystemForm({ ...systemForm, siglasistema: value.toUpperCase() })} /><label className="flex items-center gap-2 text-sm font-bold text-[#36536F]"><Checkbox checked={systemForm.utilizaptf === "S"} onCheckedChange={(checked) => setSystemForm({ ...systemForm, utilizaptf: checked ? "S" : "N" })} />Utiliza PTF</label><FormActions editing={Boolean(editingSystem)} saving={saving} onSave={() => void submitSystem()} onCancel={() => { setEditingSystem(null); setSystemForm(systemInitial); }} /></>} table={<DataTable headers={["Sistema", "Descrição", "Sigla", "Ações"]}>{catalog.sistemas.map((system) => <TableRow key={system.SISTEMA}><TableCell className="font-black text-[#173D6E]">{system.SISTEMA}</TableCell><TableCell>{system.DESCRICAO}</TableCell><TableCell>{system.SIGLASISTEMA}</TableCell><ActionCell onEdit={() => editSystem(system)} onDelete={() => void deleteSystem(system.SISTEMA)} /></TableRow>)}</DataTable>} />
          </TabsContent>

          <TabsContent value="modulos">
            <ManagementLayout form={<><SelectField label="Sistema" value={moduleForm.sistema} disabled={Boolean(editingModule)} onChange={(value) => setModuleForm({ ...moduleForm, sistema: value })} options={catalog.sistemas.map((item) => ({ value: item.SISTEMA, label: item.SISTEMA }))} /><FormField label="Código" value={moduleForm.modulo} disabled={Boolean(editingModule)} onChange={(value) => setModuleForm({ ...moduleForm, modulo: value.toUpperCase() })} /><FormField label="Descrição" value={moduleForm.descricao} onChange={(value) => setModuleForm({ ...moduleForm, descricao: value })} /><FormField label="Sigla" value={moduleForm.siglamodulo} onChange={(value) => setModuleForm({ ...moduleForm, siglamodulo: value.toUpperCase() })} /><FormField label="Ordem" type="number" value={moduleForm.ordem} onChange={(value) => setModuleForm({ ...moduleForm, ordem: value })} /><FormActions editing={Boolean(editingModule)} saving={saving} onSave={() => void submitModule()} onCancel={() => { setEditingModule(null); setModuleForm(moduleInitial); }} /></>} table={<DataTable headers={["Sistema", "Módulo", "Descrição", "Ordem", "Ações"]}>{catalog.modulos.map((module) => <TableRow key={`${module.SISTEMA}-${module.MODULO}`}><TableCell>{module.SISTEMA}</TableCell><TableCell className="font-black text-[#173D6E]">{module.MODULO}</TableCell><TableCell>{module.DESCRICAO}</TableCell><TableCell>{module.ORDEM ?? "—"}</TableCell><ActionCell onEdit={() => editModule(module)} onDelete={() => void deleteModule(module)} /></TableRow>)}</DataTable>} />
          </TabsContent>

          <TabsContent value="aplicacoes">
            <ManagementLayout form={<><FormField label="Código" value={applicationForm.codaplicacao} onChange={(value) => setApplicationForm({ ...applicationForm, codaplicacao: value.toUpperCase() })} /><SelectField label="Sistema" value={applicationForm.sistema} onChange={(value) => setApplicationForm({ ...applicationForm, sistema: value, modulo: "" })} options={catalog.sistemas.map((item) => ({ value: item.SISTEMA, label: item.SISTEMA }))} /><SelectField label="Módulo" value={applicationForm.modulo} onChange={(value) => setApplicationForm({ ...applicationForm, modulo: value })} options={modulesForApplication.map((item) => ({ value: item.MODULO, label: item.MODULO }))} /><FormField label="Descrição" value={applicationForm.descricao} onChange={(value) => setApplicationForm({ ...applicationForm, descricao: value })} /><FormActions editing={Boolean(editingApplication)} saving={saving} onSave={() => void submitApplication()} onCancel={() => { setEditingApplication(null); setApplicationForm(applicationInitial); }} /></>} table={<DataTable headers={["Código", "Sistema", "Módulo", "Descrição", "Ações"]}>{catalog.aplicacoes.map((application) => <TableRow key={application.SEQAPLICACAO}><TableCell className="font-black text-[#173D6E]">{application.CODAPLICACAO}</TableCell><TableCell>{application.SISTEMA}</TableCell><TableCell>{application.MODULO}</TableCell><TableCell>{application.DESCRICAO}</TableCell><ActionCell onEdit={() => editApplication(application)} onDelete={() => void deleteApplication(application)} /></TableRow>)}</DataTable>} />
          </TabsContent>

          <TabsContent value="empresas">
            <Card className="border-[#D4DFE9]"><CardHeader><CardTitle className="text-base text-[#173D6E]">Empresas disponíveis</CardTitle><p className="text-xs text-[#6B7F92]">Consulta da VCGV_EMPRESA. Alterações são feitas somente no ERP.</p></CardHeader><CardContent><DataTable headers={["Código", "Nome reduzido", "Fantasia", "Razão social", "Status"]}>{catalog.empresas.map((company) => <TableRow key={company.NROEMPRESA}><TableCell className="font-black text-[#173D6E]">{company.NROEMPRESA}</TableCell><TableCell>{company.NOMEREDUZIDO || "—"}</TableCell><TableCell>{company.FANTASIA || "—"}</TableCell><TableCell>{company.RAZAOSOCIAL || "—"}</TableCell><TableCell><Badge variant={company.STATUS === "A" ? "default" : "secondary"}>{company.STATUS || "—"}</Badge></TableCell></TableRow>)}</DataTable></CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ManagementLayout({ form, table }: { form: React.ReactNode; table: React.ReactNode }) {
  return <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]"><Card className="border-[#D4DFE9]"><CardHeader><CardTitle className="text-base text-[#173D6E]">Cadastro</CardTitle></CardHeader><CardContent className="space-y-4">{form}</CardContent></Card><Card className="min-w-0 border-[#D4DFE9]"><CardContent className="overflow-x-auto p-0">{table}</CardContent></Card></div>;
}

function FormField({ label, value, onChange, disabled, type = "text" }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; type?: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Input type={type} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} /></div>;
}

function SelectField({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; disabled?: boolean }) {
  return <div className="space-y-2"><Label>{label}</Label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}><option value="">Selecione...</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
}

function FormActions({ editing, saving, onSave, onCancel }: { editing: boolean; saving: boolean; onSave: () => void; onCancel: () => void }) {
  return <div className="flex gap-2 pt-1"><Button className="flex-1" onClick={onSave} disabled={saving}>{editing ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}{editing ? "Salvar" : "Adicionar"}</Button>{editing && <Button variant="outline" onClick={onCancel}>Cancelar</Button>}</div>;
}

function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return <div className="w-full overflow-x-auto"><Table><TableHeader className="bg-[#EDF3F8]"><TableRow>{headers.map((header) => <TableHead key={header} className="whitespace-nowrap text-[10px] font-black uppercase tracking-wider text-[#47627D]">{header}</TableHead>)}</TableRow></TableHeader><TableBody>{children}</TableBody></Table></div>;
}

function ActionCell({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <TableCell><div className="flex gap-1"><Button size="icon" variant="ghost" onClick={onEdit} title="Editar"><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={onDelete} title="Excluir"><Trash2 className="h-4 w-4" /></Button></div></TableCell>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-[#C9D6E2] bg-[#F8FAFC] p-8 text-center"><UserCog className="mb-3 h-9 w-9 text-[#8CA2B7]" /><p className="text-sm font-bold text-[#60758A]">{text}</p></div>;
}
