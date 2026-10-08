import React, { useState } from "react";
import { Calendar, FileCheck, FileX, Sparkles, Wrench, Pencil, Check, X } from "lucide-react";
import * as db from "./db";

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

const inputStyle = {
  width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`,
  fontSize: 14, fontFamily: "inherit", color: COLORS.ink, boxSizing: "border-box", background: COLORS.card,
};
const selectStyle = { ...inputStyle, appearance: "auto" };
const primaryBtnStyle = {
  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
  background: COLORS.teal, color: "#fff", border: "none", borderRadius: 10, padding: "12px 16px",
  fontSize: 14, fontWeight: 700, cursor: "pointer",
};

function Pill({ tone, children }) {
  const map = {
    rust: { bg: COLORS.rustBg, color: COLORS.rust },
    moss: { bg: COLORS.mossBg, color: COLORS.moss },
    amber: { bg: COLORS.amberBg, color: COLORS.amber },
  };
  const c = map[tone];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: c.bg, color: c.color, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}>
      {children}
    </span>
  );
}

function SectionLabel({ children, style }) {
  return <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: COLORS.tealLight, fontWeight: 700, marginBottom: 8, ...style }}>{children}</div>;
}

function fmtDate(d) {
  if (!d) return "—";
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function fmtDateLong(d) {
  if (!d) return "—";
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("pt-BR");
}
function diasAte(d) {
  if (!d) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(d + "T00:00:00");
  return Math.round((alvo - hoje) / 86400000);
}

export default function PainelOperacional({ properties, sessions, maintenance, reservas, limpezaManual = [], onToggleDocumento, onAddReserva, onSaveLimpezaManual, saving }) {
  const [showForm, setShowForm] = useState(false);

  const ultimaLimpezaPorImovel = {};
  sessions.forEach((s) => {
    const atual = ultimaLimpezaPorImovel[s.propertyName];
    if (!atual || new Date(s.startedAt) > new Date(atual.startedAt)) {
      ultimaLimpezaPorImovel[s.propertyName] = s;
    }
  });

  const limpezaManualPorImovel = {};
  limpezaManual.forEach((l) => { limpezaManualPorImovel[l.imovelId] = l; });

  const manutencaoAbertaPorImovel = {};
  maintenance.forEach((m) => {
    if (m.status === "aberto") {
      manutencaoAbertaPorImovel[m.propertyName] = (manutencaoAbertaPorImovel[m.propertyName] || 0) + 1;
    }
  });

  // até 2 próximas reservas por imóvel, ordenadas por checkin
  const hoje = new Date().toISOString().slice(0, 10);
  const proximasReservasPorImovel = {};
  reservas
    .filter((r) => r.checkout >= hoje)
    .sort((a, b) => a.checkin.localeCompare(b.checkin))
    .forEach((r) => {
      if (!proximasReservasPorImovel[r.residencia_nome]) proximasReservasPorImovel[r.residencia_nome] = [];
      if (proximasReservasPorImovel[r.residencia_nome].length < 2) {
        proximasReservasPorImovel[r.residencia_nome].push(r);
      }
    });

  // ordena imóveis: quem tem reserva mais próxima vem primeiro; sem reserva, por último
  const propertiesOrdenadas = [...properties].sort((a, b) => {
    const ra = proximasReservasPorImovel[a.name]?.[0];
    const rb = proximasReservasPorImovel[b.name]?.[0];
    if (ra && !rb) return -1;
    if (!ra && rb) return 1;
    if (ra && rb) return ra.checkin.localeCompare(rb.checkin);
    return 0;
  });

  if (showForm) {
    return (
      <ReservaForm
        properties={properties}
        onCancel={() => setShowForm(false)}
        onSave={async (dados) => { await onAddReserva(dados); setShowForm(false); }}
        saving={saving}
      />
    );
  }

  return (
    <div style={{ paddingTop: 16 }}>
      <button onClick={() => setShowForm(true)} style={{ ...primaryBtnStyle, maxWidth: 260 }}>
        <Calendar size={16} /> Nova reserva
      </button>

      {properties.length === 0 && (
        <div style={{ fontSize: 13, color: COLORS.muted, textAlign: "center", marginTop: 20 }}>
          Cadastre imóveis na aba Imóveis para ver o painel.
        </div>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 14,
        marginTop: 16,
      }}>
        {propertiesOrdenadas.map((p) => {
          const proximas = proximasReservasPorImovel[p.name] || [];
          const limpezaAuto = ultimaLimpezaPorImovel[p.name];
          const limpezaManualDoImovel = limpezaManualPorImovel[p.id];
          const manutencaoAberta = manutencaoAbertaPorImovel[p.name] || 0;

          return (
            <div key={p.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{p.name}</div>

              {/* Reservas (até 2) */}
              {proximas.length === 0 ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
                  <div style={{ fontSize: 13, color: COLORS.muted, display: "flex", alignItems: "center", gap: 6 }}>
                    <Calendar size={14} /> Próxima reserva
                  </div>
                  <span style={{ fontSize: 12, color: COLORS.muted }}>Nenhuma agendada</span>
                </div>
              ) : (
                proximas.map((reserva, idx) => {
                  const dias = diasAte(reserva.checkin);
                  return (
                    <div key={reserva.id} style={{ padding: "6px 0", borderTop: idx > 0 ? `1px solid ${COLORS.border}` : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 13, color: COLORS.muted, display: "flex", alignItems: "center", gap: 6 }}>
                          <Calendar size={14} /> {idx === 0 ? "Próxima reserva" : "Reserva seguinte"}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>
                            {fmtDate(reserva.checkin)} → {fmtDate(reserva.checkout)}
                          </div>
                          <div style={{ fontSize: 11, color: COLORS.muted }}>
                            {reserva.hospede_nome || "—"} {dias !== null && dias >= 0 ? `· em ${dias}d` : ""}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                        <div style={{ fontSize: 12, color: COLORS.muted, display: "flex", alignItems: "center", gap: 6 }}>
                          {reserva.documento_enviado ? <FileCheck size={13} /> : <FileX size={13} />} Documento
                        </div>
                        <button
                          onClick={() => onToggleDocumento(reserva.id, !reserva.documento_enviado)}
                          style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }}
                        >
                          <Pill tone={reserva.documento_enviado ? "moss" : "amber"}>
                            {reserva.documento_enviado ? "Enviado" : "Pendente"}
                          </Pill>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Última limpeza (automática, ou manual como fallback) */}
              <div style={{ padding: "6px 0", borderTop: `1px solid ${COLORS.border}` }}>
                {limpezaAuto ? (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 13, color: COLORS.muted, display: "flex", alignItems: "center", gap: 6 }}>
                      <Sparkles size={14} /> Última limpeza
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{new Date(limpezaAuto.startedAt).toLocaleDateString("pt-BR")}</div>
                      <div style={{ fontSize: 11, color: COLORS.muted }}>{limpezaAuto.staffName}</div>
                    </div>
                  </div>
                ) : (
                  <LimpezaManualField
                    valor={limpezaManualDoImovel?.data}
                    onSalvar={(data) => onSaveLimpezaManual(p.id, data)}
                  />
                )}
              </div>

              {/* Manutenção */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderTop: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: 13, color: COLORS.muted, display: "flex", alignItems: "center", gap: 6 }}>
                  <Wrench size={14} /> Manutenção
                </div>
                <Pill tone={manutencaoAberta > 0 ? "rust" : "moss"}>
                  {manutencaoAberta > 0 ? `${manutencaoAberta} aberta(s)` : "OK"}
                </Pill>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LimpezaManualField({ valor, onSalvar }) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(valor || "");

  if (editando) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ fontSize: 13, color: COLORS.muted, display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
          <Sparkles size={14} /> Última limpeza
        </div>
        <input
          type="date"
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
          style={{ ...inputStyle, width: 140, padding: "5px 8px", fontSize: 12 }}
          autoFocus
        />
        <button onClick={() => { if (rascunho) { onSalvar(rascunho); setEditando(false); } }} style={{ border: "none", background: "none", cursor: "pointer", color: COLORS.moss, padding: 2 }}>
          <Check size={16} />
        </button>
        <button onClick={() => { setRascunho(valor || ""); setEditando(false); }} style={{ border: "none", background: "none", cursor: "pointer", color: COLORS.rust, padding: 2 }}>
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ fontSize: 13, color: COLORS.muted, display: "flex", alignItems: "center", gap: 6 }}>
        <Sparkles size={14} /> Última limpeza
      </div>
      <button onClick={() => setEditando(true)} style={{ border: "none", background: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 6 }}>
        {valor ? (
          <>
            <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink }}>{fmtDateLong(valor)}</span>
            <Pill tone="amber">manual</Pill>
            <Pencil size={12} color={COLORS.muted} />
          </>
        ) : (
          <span style={{ fontSize: 12, color: COLORS.tealLight, textDecoration: "underline" }}>Sem registro — clique para preencher</span>
        )}
      </button>
    </div>
  );
}

function ReservaForm({ properties, onCancel, onSave, saving }) {
  const [propertyName, setPropertyName] = useState("");
  const [hospede, setHospede] = useState("");
  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [plataforma, setPlataforma] = useState("Airbnb");
  const canSave = propertyName && checkin && checkout;

  return (
    <div style={{ paddingTop: 16, maxWidth: 400 }}>
      <button onClick={onCancel} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 13, padding: 0, marginBottom: 10, cursor: "pointer" }}>
        ← Cancelar
      </button>
      <SectionLabel>Imóvel</SectionLabel>
      <select value={propertyName} onChange={(e) => setPropertyName(e.target.value)} style={selectStyle}>
        <option value="">Selecione o imóvel</option>
        {properties.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
      </select>
      <SectionLabel style={{ marginTop: 16 }}>Hóspede</SectionLabel>
      <input placeholder="Nome do hóspede" value={hospede} onChange={(e) => setHospede(e.target.value)} style={inputStyle} />
      <SectionLabel style={{ marginTop: 16 }}>Datas</SectionLabel>
      <div style={{ display: "flex", gap: 8 }}>
        <input type="date" value={checkin} onChange={(e) => setCheckin(e.target.value)} style={inputStyle} />
        <input type="date" value={checkout} onChange={(e) => setCheckout(e.target.value)} style={inputStyle} />
      </div>
      <SectionLabel style={{ marginTop: 16 }}>Plataforma</SectionLabel>
      <select value={plataforma} onChange={(e) => setPlataforma(e.target.value)} style={selectStyle}>
        <option>Airbnb</option>
        <option>Booking</option>
        <option>Direto</option>
        <option>Outra</option>
      </select>
      <button onClick={() => onSave({ residencia_nome: propertyName, hospede_nome: hospede, checkin, checkout, plataforma })} disabled={!canSave || saving} style={{ ...primaryBtnStyle, marginTop: 24, opacity: canSave && !saving ? 1 : 0.5 }}>
        {saving ? "Salvando..." : "Salvar reserva"}
      </button>
    </div>
  );
}
