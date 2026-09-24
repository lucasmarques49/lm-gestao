import React, { useState, useEffect, useCallback } from "react";
import {
  Plus, Trash2, Home, History, Users, Save, Camera, Video, Lock, Wrench, Calendar,
} from "lucide-react";
import * as db from "./db";
import PainelOperacional from "./PainelOperacional";

const LOGO_SRC = "SUBSTITUA_PELO_MESMO_LOGO_SRC_DO_APP_ORIGINAL";

const COLORS = {
  ink: "#16302E",
  teal: "#1F4B4A",
  tealLight: "#2E6B69",
  sand: "#EEF2ED",
  card: "#FFFFFF",
  border: "#D8DED6",
  rust: "#B4472C",
  rustBg: "#FBEAE5",
  moss: "#4C7A57",
  mossBg: "#E7F1E9",
  amber: "#A87418",
  amberBg: "#FBF1DE",
  muted: "#6B776F",
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || "1508";

const DEFAULT_LINEN = [
  { label: "Lençol casal", expected: 2 },
  { label: "Lençol solteiro", expected: 2 },
  { label: "Fronha", expected: 4 },
  { label: "Edredom / cobre-leito", expected: 2 },
  { label: "Travesseiro", expected: 4 },
  { label: "Toalha de banho", expected: 4 },
  { label: "Toalha de rosto", expected: 4 },
  { label: "Toalha de piso", expected: 2 },
];
const DEFAULT_ROOMS = [
  { name: "Sala", items: ["TV e controle remoto", "Sofá / estofados", "Tapete", "Ar-condicionado"] },
  { name: "Cozinha", items: ["Fogão / cooktop", "Geladeira", "Micro-ondas", "Utensílios completos"] },
  { name: "Quarto 1", items: ["Ar-condicionado", "Armário", "Iluminação"] },
  { name: "Banheiro", items: ["Chuveiro / aquecedor", "Descarga", "Ralo sem entupimento"] },
];

export default function App() {
  const [tab, setTab] = useState("painel");
  const [unlocked, setUnlocked] = useState(false);
  const [properties, setProperties] = useState([]);
  const [staff, setStaff] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [editingProperty, setEditingProperty] = useState(null);
  const [expandedSession, setExpandedSession] = useState(null);
  const [saving, setSaving] = useState(false);

  const reloadAll = useCallback(async () => {
    try {
      const [props, stf, sess, maint, resv] = await Promise.all([
        db.fetchProperties(),
        db.fetchStaff(),
        db.fetchSessions(),
        db.fetchMaintenance(),
        db.fetchReservas(),
      ]);
      setProperties(props);
      setStaff(stf);
      setSessions(sess);
      setMaintenance(maint);
      setReservas(resv);
      setLoadError("");
    } catch (err) {
      setLoadError("Não foi possível conectar ao banco de dados. Confira as variáveis VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.");
      console.error(err);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (unlocked) reloadAll();
  }, [unlocked, reloadAll]);

  const newPropertyDraft = () => ({
    id: uid(),
    name: "",
    address: "",
    linenItems: DEFAULT_LINEN.map((li) => ({ id: uid(), ...li })),
    rooms: DEFAULT_ROOMS.map((r) => ({ id: uid(), name: r.name, items: r.items.map((label) => ({ id: uid(), label })) })),
  });

  const saveProperty = async (p) => {
    if (!p.name.trim()) return;
    setSaving(true);
    try {
      await db.saveProperty(p);
      await reloadAll();
      setEditingProperty(null);
    } catch (err) {
      alert("Erro ao salvar imóvel: " + err.message);
    } finally {
      setSaving(false);
    }
  };
  const deleteProperty = async (id) => {
    try {
      await db.deleteProperty(id);
      await reloadAll();
    } catch (err) {
      alert("Erro ao remover imóvel: " + err.message);
    }
  };
  const addStaff = async (name) => {
    if (!name.trim()) return;
    try {
      await db.addStaff(name.trim());
      await reloadAll();
    } catch (err) {
      alert("Erro ao adicionar funcionária: " + err.message);
    }
  };
  const removeStaff = async (id) => {
    try {
      await db.removeStaff(id);
      await reloadAll();
    } catch (err) {
      alert("Erro ao remover funcionária: " + err.message);
    }
  };
  const addManualMaintenance = async (entry) => {
    setSaving(true);
    try {
      await db.addManualMaintenance(entry);
      await reloadAll();
    } catch (err) {
      alert("Erro ao registrar problema: " + err.message);
    } finally {
      setSaving(false);
    }
  };
  const resolveMaintenance = async (id, status) => {
    try {
      await db.setMaintenanceStatus(id, status);
      await reloadAll();
    } catch (err) {
      alert("Erro ao atualizar status: " + err.message);
    }
  };
  const addReserva = async (dados) => {
    setSaving(true);
    try {
      await db.saveReserva(dados);
      await reloadAll();
    } catch (err) {
      alert("Erro ao salvar reserva: " + err.message);
    } finally {
      setSaving(false);
    }
  };
  const toggleDocumento = async (id, valor) => {
    try {
      await db.setDocumentoEnviado(id, valor);
      await reloadAll();
    } catch (err) {
      alert("Erro ao atualizar documento: " + err.message);
    }
  };

  if (!unlocked) {
    return <PinGate onUnlock={() => setUnlocked(true)} />;
  }

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.muted, fontFamily: "system-ui, -apple-system, sans-serif" }}>
        Carregando...
      </div>
    );
  }
  if (loadError) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", color: COLORS.rust, fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 13 }}>
        {loadError}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", background: COLORS.sand, minHeight: "100vh", color: COLORS.ink }}>
      <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 90 }}>
        <Header onLock={() => setUnlocked(false)} />
        <div style={{ padding: "0 16px" }}>
          {editingProperty ? (
            <PropertyEditor property={editingProperty} onCancel={() => setEditingProperty(null)} onSave={saveProperty} saving={saving} />
          ) : tab === "painel" ? (
            <PainelOperacional
              properties={properties}
              sessions={sessions}
              maintenance={maintenance}
              reservas={reservas}
              onToggleDocumento={toggleDocumento}
              onAddReserva={addReserva}
              saving={saving}
            />
          ) : tab === "imoveis" ? (
            <ImoveisTab
              properties={properties}
              onAdd={() => setEditingProperty(newPropertyDraft())}
              onEdit={setEditingProperty}
              onDelete={deleteProperty}
            />
          ) : tab === "funcionarias" ? (
            <FuncionariasTab staff={staff} onAdd={addStaff} onRemove={removeStaff} />
          ) : tab === "manutencao" ? (
            <ManutencaoTab
              maintenance={maintenance}
              properties={properties}
              onAddManual={addManualMaintenance}
              onResolve={resolveMaintenance}
              saving={saving}
            />
          ) : tab === "historico" ? (
            <HistoricoTab sessions={sessions} expandedSession={expandedSession} setExpandedSession={setExpandedSession} />
          ) : null}
        </div>
      </div>
      {!editingProperty && <BottomNav tab={tab} setTab={setTab} />}
    </div>
  );
}

function PinGate({ onUnlock }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const submit = () => {
    if (pin === ADMIN_PIN) onUnlock();
    else { setError(true); setPin(""); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: COLORS.sand, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 260, textAlign: "center" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: COLORS.tealLight, fontWeight: 600, marginBottom: 4 }}>
          L&amp;M Residências
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Painel de Gestão</div>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => { setPin(e.target.value); setError(false); }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          style={{ ...inputStyle, textAlign: "center", letterSpacing: "0.3em" }}
          autoFocus
          placeholder="PIN"
        />
        {error && <div style={{ fontSize: 11, color: COLORS.rust, marginTop: 4 }}>PIN incorreto</div>}
        <button onClick={submit} style={{ ...primaryBtnStyle, marginTop: 12 }}>Entrar</button>
      </div>
    </div>
  );
}

function Header({ onLock }) {
  return (
    <div style={{ padding: "16px 16px 14px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <img src={LOGO_SRC} alt="L&M Residências" style={{ width: 38, height: 38, borderRadius: 8, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: COLORS.tealLight, fontWeight: 600 }}>
            L&amp;M Residências
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 1 }}>Painel de Gestão</div>
        </div>
      </div>
      <button onClick={onLock} title="Sair" style={{ ...iconBtnStyle, flexShrink: 0 }}>
        <Lock size={14} />
      </button>
    </div>
  );
}

function BottomNav({ tab, setTab }) {
  const items = [
    { id: "painel", label: "Painel", icon: Calendar },
    { id: "imoveis", label: "Imóveis", icon: Home },
    { id: "funcionarias", label: "Equipe", icon: Users },
    { id: "manutencao", label: "Manutenção", icon: Wrench },
    { id: "historico", label: "Histórico", icon: History },
  ];
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: COLORS.card, borderTop: `1px solid ${COLORS.border}` }}>
      <div style={{ maxWidth: 480, margin: "0 auto", display: "flex" }}>
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              flex: 1, border: "none", background: "none", padding: "9px 0 11px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              color: tab === id ? COLORS.teal : COLORS.muted, cursor: "pointer",
            }}
          >
            <Icon size={18} strokeWidth={tab === id ? 2.4 : 1.8} />
            <span style={{ fontSize: 10.5, fontWeight: tab === id ? 700 : 500 }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- IMÓVEIS ---------------- */

function ImoveisTab({ properties, onAdd, onEdit, onDelete }) {
  return (
    <div style={{ paddingTop: 16 }}>
      <button onClick={onAdd} style={primaryBtnStyle}><Plus size={16} /> Novo imóvel</button>
      {properties.length === 0 && (
        <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 20, textAlign: "center" }}>Nenhum imóvel cadastrado ainda.</div>
      )}
      {properties.map((p) => (
        <div key={p.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
              {p.address && <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>{p.address}</div>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => onEdit(p)} style={iconBtnStyle}>Editar</button>
              <button onClick={() => { if (confirm(`Remover ${p.name}?`)) onDelete(p.id); }} style={{ ...iconBtnStyle, color: COLORS.rust }}><Trash2 size={14} /></button>
            </div>
          </div>
          <div style={{ fontSize: 12, color: COLORS.tealLight, marginTop: 8 }}>
            {p.rooms.length} cômodo(s) · {p.linenItems.length} itens de enxoval
          </div>
        </div>
      ))}
    </div>
  );
}

function PropertyEditor({ property, onCancel, onSave, saving }) {
  const [p, setP] = useState(property);
  const updateField = (field, value) => setP({ ...p, [field]: value });
  const addLinen = () => setP({ ...p, linenItems: [...p.linenItems, { id: uid(), label: "", expected: 1 }] });
  const updateLinen = (id, field, value) => setP({ ...p, linenItems: p.linenItems.map((i) => (i.id === id ? { ...i, [field]: value } : i)) });
  const removeLinen = (id) => setP({ ...p, linenItems: p.linenItems.filter((i) => i.id !== id) });
  const addRoom = () => setP({ ...p, rooms: [...p.rooms, { id: uid(), name: "", items: [] }] });
  const updateRoomName = (id, name) => setP({ ...p, rooms: p.rooms.map((r) => (r.id === id ? { ...r, name } : r)) });
  const removeRoom = (id) => setP({ ...p, rooms: p.rooms.filter((r) => r.id !== id) });
  const addRoomItem = (roomId) => setP({ ...p, rooms: p.rooms.map((r) => (r.id === roomId ? { ...r, items: [...r.items, { id: uid(), label: "" }] } : r)) });
  const updateRoomItem = (roomId, itemId, label) => setP({ ...p, rooms: p.rooms.map((r) => (r.id !== roomId ? r : { ...r, items: r.items.map((i) => (i.id === itemId ? { ...i, label } : i)) })) });
  const removeRoomItem = (roomId, itemId) => setP({ ...p, rooms: p.rooms.map((r) => (r.id !== roomId ? r : { ...r, items: r.items.filter((i) => i.id !== itemId) })) });

  return (
    <div style={{ paddingTop: 16 }}>
      <BackRow onBack={onCancel} label="Cancelar" />
      <SectionLabel>Dados do imóvel</SectionLabel>
      <input placeholder="Nome do imóvel" value={p.name} onChange={(e) => updateField("name", e.target.value)} style={inputStyle} />
      <input placeholder="Endereço (opcional)" value={p.address} onChange={(e) => updateField("address", e.target.value)} style={{ ...inputStyle, marginTop: 8 }} />

      <SectionLabel style={{ marginTop: 22 }}>Enxoval e estoque</SectionLabel>
      {p.linenItems.map((item) => (
        <div key={item.id} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
          <input value={item.label} onChange={(e) => updateLinen(item.id, "label", e.target.value)} placeholder="Item" style={{ ...inputStyle, flex: 1 }} />
          <input type="number" min="0" value={item.expected} onChange={(e) => updateLinen(item.id, "expected", Math.max(0, parseInt(e.target.value) || 0))} style={{ ...inputStyle, width: 60, textAlign: "center" }} />
          <button onClick={() => removeLinen(item.id)} style={{ ...iconBtnStyle, color: COLORS.rust, flexShrink: 0 }}><Trash2 size={14} /></button>
        </div>
      ))}
      <button onClick={addLinen} style={addRowBtnStyle}><Plus size={14} /> Adicionar item de enxoval</button>

      <SectionLabel style={{ marginTop: 22 }}>Cômodos e pontos de checagem</SectionLabel>
      {p.rooms.map((room) => (
        <div key={room.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={room.name} onChange={(e) => updateRoomName(room.id, e.target.value)} placeholder="Nome do cômodo (ex: Sala)" style={{ ...inputStyle, flex: 1, fontWeight: 700 }} />
            <button onClick={() => removeRoom(room.id)} style={{ ...iconBtnStyle, color: COLORS.rust, flexShrink: 0 }}><Trash2 size={14} /></button>
          </div>
          <div style={{ marginTop: 8 }}>
            {room.items.map((item) => (
              <div key={item.id} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <input value={item.label} onChange={(e) => updateRoomItem(room.id, item.id, e.target.value)} placeholder="Ponto a checar" style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => removeRoomItem(room.id, item.id)} style={{ ...iconBtnStyle, color: COLORS.rust, flexShrink: 0 }}><Trash2 size={14} /></button>
              </div>
            ))}
            <button onClick={() => addRoomItem(room.id)} style={{ ...addRowBtnStyle, padding: "6px 10px", fontSize: 12 }}><Plus size={12} /> Adicionar ponto</button>
          </div>
        </div>
      ))}
      <button onClick={addRoom} style={addRowBtnStyle}><Plus size={14} /> Adicionar cômodo</button>

      <button onClick={() => onSave(p)} disabled={!p.name.trim() || saving} style={{ ...primaryBtnStyle, marginTop: 24, opacity: p.name.trim() && !saving ? 1 : 0.5 }}>
        <Save size={16} /> {saving ? "Salvando..." : "Salvar imóvel"}
      </button>
    </div>
  );
}

/* ---------------- FUNCIONÁRIAS ---------------- */

function FuncionariasTab({ staff, onAdd, onRemove }) {
  const [name, setName] = useState("");
  return (
    <div style={{ paddingTop: 16 }}>
      <SectionLabel>Adicionar à equipe</SectionLabel>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da funcionária" style={{ ...inputStyle, flex: 1 }} />
        <button onClick={() => { onAdd(name); setName(""); }} disabled={!name.trim()} style={{ ...primaryBtnStyle, width: "auto", padding: "0 16px", opacity: name.trim() ? 1 : 0.5 }}>
          <Plus size={16} />
        </button>
      </div>
      <div style={{ marginTop: 16 }}>
        {staff.length === 0 && <div style={{ fontSize: 13, color: COLORS.muted, textAlign: "center", marginTop: 20 }}>Nenhuma funcionária cadastrada ainda.</div>}
        {staff.map((s) => (
          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</span>
            <button onClick={() => onRemove(s.id)} style={{ ...iconBtnStyle, color: COLORS.rust }}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- MANUTENÇÃO ---------------- */

function ManutencaoTab({ maintenance, properties, onAddManual, onResolve, saving }) {
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState("aberto");
  const [propertyFilter, setPropertyFilter] = useState("todos");

  const filtered = maintenance.filter((m) => {
    if (statusFilter !== "todos" && m.status !== statusFilter) return false;
    if (propertyFilter !== "todos" && m.propertyName !== propertyFilter) return false;
    return true;
  });
  const propertyNames = [...new Set(maintenance.map((m) => m.propertyName))];

  if (showForm) {
    return (
      <ManualMaintenanceForm
        properties={properties}
        onCancel={() => setShowForm(false)}
        onSave={async (entry) => { await onAddManual(entry); setShowForm(false); }}
        saving={saving}
      />
    );
  }

  return (
    <div style={{ paddingTop: 16 }}>
      <button onClick={() => setShowForm(true)} style={primaryBtnStyle}>
        <Plus size={16} /> Novo problema (relatado por fora)
      </button>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
          <option value="aberto">Abertos</option>
          <option value="resolvido">Resolvidos</option>
          <option value="todos">Todos</option>
        </select>
        <select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
          <option value="todos">Todos os imóveis</option>
          {propertyNames.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      {filtered.length === 0 && (
        <div style={{ fontSize: 13, color: COLORS.muted, textAlign: "center", marginTop: 30 }}>Nenhum item de manutenção nesse filtro.</div>
      )}
      {filtered.map((m) => (
        <div key={m.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{m.titulo}</div>
              <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>{m.propertyName}</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <Pill tone={m.origem === "manual" ? "amber" : "moss"}>{m.origem === "manual" ? "Relatado" : "Checklist"}</Pill>
              <Pill tone={m.prioridade === "alta" ? "rust" : m.prioridade === "media" ? "amber" : "moss"}>{m.prioridade}</Pill>
            </div>
          </div>
          {m.descricao && <div style={{ fontSize: 13, marginTop: 8, color: COLORS.ink }}>{m.descricao}</div>}
          {m.midiaUrl && (
            <a href={m.midiaUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: COLORS.tealLight, marginTop: 6, display: "inline-block" }}>ver foto/vídeo</a>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
            <div style={{ fontSize: 11, color: COLORS.muted }}>
              {m.reportadoPor && `${m.reportadoPor} · `}{new Date(m.criadoEm).toLocaleDateString("pt-BR")}
            </div>
            {m.status === "aberto" ? (
              <button onClick={() => onResolve(m.id, "resolvido")} style={{ ...secondaryBtnStyle, padding: "6px 12px", fontSize: 12 }}>Marcar resolvido</button>
            ) : (
              <button onClick={() => onResolve(m.id, "aberto")} style={{ ...iconBtnStyle, fontSize: 12 }}>Reabrir</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ManualMaintenanceForm({ properties, onCancel, onSave, saving }) {
  const [propertyId, setPropertyId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState("media");
  const [reportadoPor, setReportadoPor] = useState("");
  const [midiaUrl, setMidiaUrl] = useState("");
  const canSave = propertyId && titulo.trim();

  return (
    <div style={{ paddingTop: 16 }}>
      <BackRow onBack={onCancel} label="Cancelar" />
      <SectionLabel>Imóvel</SectionLabel>
      <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} style={selectStyle}>
        <option value="">Selecione o imóvel</option>
        {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <SectionLabel style={{ marginTop: 16 }}>O que aconteceu</SectionLabel>
      <input placeholder="Ex: Ar-condicionado do quarto não gela" value={titulo} onChange={(e) => setTitulo(e.target.value)} style={inputStyle} />
      <textarea placeholder="Detalhes (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} style={{ ...inputStyle, marginTop: 8, minHeight: 60, resize: "vertical" }} />
      <SectionLabel style={{ marginTop: 16 }}>Prioridade</SectionLabel>
      <div style={{ display: "flex", gap: 8 }}>
        {["baixa", "media", "alta"].map((p) => (
          <button key={p} onClick={() => setPrioridade(p)} style={{
            flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
            border: `1px solid ${prioridade === p ? COLORS.teal : COLORS.border}`,
            background: prioridade === p ? COLORS.teal : "transparent",
            color: prioridade === p ? "#fff" : COLORS.muted, textTransform: "capitalize",
          }}>{p}</button>
        ))}
      </div>
      <SectionLabel style={{ marginTop: 16 }}>Relatado por (opcional)</SectionLabel>
      <input placeholder="Ex: hóspede via Airbnb, Marcello, telefone" value={reportadoPor} onChange={(e) => setReportadoPor(e.target.value)} style={inputStyle} />
      <SectionLabel style={{ marginTop: 16 }}>Foto (opcional)</SectionLabel>
      <MediaField fileUrl={midiaUrl} onUploaded={setMidiaUrl} />
      <button onClick={() => onSave({ propertyId, titulo: titulo.trim(), descricao, prioridade, reportadoPor, midiaUrl })} disabled={!canSave || saving} style={{ ...primaryBtnStyle, marginTop: 24, opacity: canSave && !saving ? 1 : 0.5 }}>
        <Save size={16} /> {saving ? "Salvando..." : "Registrar problema"}
      </button>
    </div>
  );
}

/* ---------------- HISTÓRICO ---------------- */

function HistoricoTab({ sessions, expandedSession, setExpandedSession }) {
  if (sessions.length === 0) {
    return <EmptyState title="Nenhum checklist registrado" body="Os checklists finalizados pela equipe aparecem aqui." />;
  }
  return (
    <div style={{ paddingTop: 16 }}>
      {sessions.map((s) => {
        const linenIssues = s.linen.filter((l) => l.actual !== l.expected || l.damaged).length;
        const roomIssues = s.rooms.flatMap((r) => r.items.filter((i) => i.status === "erro")).length;
        const expanded = expandedSession === s.id;
        const started = new Date(s.startedAt);
        return (
          <div key={s.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
            <button onClick={() => setExpandedSession(expanded ? null : s.id)} style={{ width: "100%", textAlign: "left", padding: "12px 14px", background: "none", border: "none", cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{s.propertyName}</div>
                  <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
                    {s.staffName} · {started.toLocaleDateString("pt-BR")} {started.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {linenIssues > 0 && <Pill tone="rust">{linenIssues} enxoval</Pill>}
                  {roomIssues > 0 && <Pill tone="rust">{roomIssues} cômodo</Pill>}
                  {linenIssues === 0 && roomIssues === 0 && <Pill tone="moss">Tudo OK</Pill>}
                </div>
              </div>
            </button>
            {expanded && (
              <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 10, color: COLORS.tealLight }}>Enxoval</div>
                {s.linen.map((l) => (
                  <div key={l.id} style={{ fontSize: 13, padding: "3px 0", color: (l.actual !== l.expected || l.damaged) ? COLORS.rust : COLORS.ink }}>
                    {l.label}: {l.actual}/{l.expected}{l.damaged ? ` — avariado${l.damageDesc ? `: ${l.damageDesc}` : ""}` : ""}
                  </div>
                ))}
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 10, color: COLORS.tealLight }}>Cômodos</div>
                {s.rooms.map((r) => (
                  <div key={r.id} style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{r.name}</div>
                    {r.items.map((i) => (
                      <div key={i.id} style={{ fontSize: 13, padding: "2px 0 2px 8px", color: i.status === "erro" ? COLORS.rust : COLORS.ink }}>
                        {i.status === "erro" ? "⚠ " : "✓ "}{i.label}{i.desc ? ` — ${i.desc}` : ""}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- COMPARTILHADOS ---------------- */

function MediaField({ fileUrl, onUploaded, video }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [status, setStatus] = useState("idle");
  const inputId = "file-" + React.useId();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setStatus("uploading");
    try {
      const url = await db.uploadMedia(file);
      onUploaded(url);
      setStatus("idle");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  return (
    <div style={{ marginTop: 8 }}>
      <label htmlFor={inputId} style={{ display: "flex", alignItems: "center", gap: 8, border: `1px dashed ${COLORS.border}`, borderRadius: 8, padding: "10px 12px", cursor: "pointer", color: COLORS.tealLight, fontSize: 12.5, fontWeight: 600 }}>
        {video ? <Video size={15} /> : <Camera size={15} />}
        {status === "uploading" ? "Enviando..." : fileUrl ? "Arquivo enviado ✓ (trocar)" : "Anexar foto"}
      </label>
      <input id={inputId} type="file" accept="image/*,video/*" onChange={handleFile} style={{ display: "none" }} />
      {status === "error" && <div style={{ fontSize: 11, color: COLORS.rust, marginTop: 4 }}>Falha ao enviar. Tente novamente.</div>}
      {previewUrl && <img src={previewUrl} alt="preview" style={{ width: "100%", borderRadius: 8, marginTop: 6, maxHeight: 160, objectFit: "cover" }} />}
    </div>
  );
}

function Pill({ tone, children }) {
  const map = {
    rust: { bg: COLORS.rustBg, color: COLORS.rust },
    moss: { bg: COLORS.mossBg, color: COLORS.moss },
    amber: { bg: COLORS.amberBg, color: COLORS.amber },
  };
  const c = map[tone];
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: c.bg, color: c.color, whiteSpace: "nowrap" }}>{children}</span>;
}

function BackRow({ onBack, label }) {
  return (
    <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: COLORS.muted, fontSize: 13, padding: 0, marginBottom: 10, cursor: "pointer" }}>
      ← {label}
    </button>
  );
}

function SectionLabel({ children, style }) {
  return <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: COLORS.tealLight, fontWeight: 700, marginBottom: 8, ...style }}>{children}</div>;
}

function EmptyState({ title, body }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
      <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 6 }}>{body}</div>
    </div>
  );
}

const inputStyle = { width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: "inherit", color: COLORS.ink, boxSizing: "border-box", background: COLORS.card };
const selectStyle = { ...inputStyle, appearance: "auto" };
const primaryBtnStyle = { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: COLORS.teal, color: "#fff", border: "none", borderRadius: 10, padding: "12px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" };
const secondaryBtnStyle = { background: "transparent", color: COLORS.teal, border: `1px solid ${COLORS.teal}`, borderRadius: 10, padding: "12px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" };
const iconBtnStyle = { background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "5px 9px", fontSize: 12, color: COLORS.ink, cursor: "pointer", display: "flex", alignItems: "center" };
const addRowBtnStyle = { display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px dashed ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, color: COLORS.tealLight, fontWeight: 600, cursor: "pointer", width: "100%", justifyContent: "center" };
