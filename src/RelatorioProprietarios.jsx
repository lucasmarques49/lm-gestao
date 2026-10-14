import React, { useMemo, useState } from "react";
import { Copy, Check, ChevronDown, ChevronUp, Undo2 } from "lucide-react";

const COLORS = {
  ink: "#16302E",
  teal: "#1F4B4A",
  tealLight: "#2E6B69",
  card: "#FFFFFF",
  border: "#D8DED6",
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

// Imóveis dos próprios sócios: não têm repasse, não entram em relatório de proprietário.
const EXCLUIDOS = ["Versa 50003"];

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const pad = (n) => String(n).padStart(2, "0");
const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const monthKey = (iso) => iso.slice(0, 7); // "2026-10"
const addMonths = (key, n) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const nomeMes = (key) => MESES[Number(key.slice(5, 7)) - 1];
const fmtDia = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const fmtBRL = (v) =>
  "R$" + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtEnviadoEm = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function linhaEstadia(r) {
  const canal = r.plataforma ? ` (${r.plataforma})` : "";
  return `- ${fmtDia(r.checkin)} a ${fmtDia(r.checkout)} - ${fmtBRL(r.valor_dono)}${canal}`;
}

function blocoProximos(base, dataEnvio) {
  const atual = monthKey(dataEnvio);
  const seguinte = addMonths(atual, 1);

  // Entra quem ainda não saiu até a data de envio (inclui quem sai no próprio dia).
  // O mês é o do check-in; estadia em andamento que começou antes do mês atual fica no mês atual.
  const proximas = base
    .filter((r) => r.checkout >= dataEnvio && monthKey(r.checkin) <= seguinte)
    .sort((a, b) => a.checkin.localeCompare(b.checkin));

  const porMes = { [atual]: [], [seguinte]: [] };
  proximas.forEach((r) => {
    const chave = monthKey(r.checkin) < atual ? atual : monthKey(r.checkin);
    porMes[chave].push(r);
  });

  return [atual, seguinte]
    .map((chave) => {
      const linhas = porMes[chave].length
        ? porMes[chave].map(linhaEstadia).join("\n")
        : "- Nenhuma reserva confirmada até o momento";
      return `${nomeMes(chave)}:\n${linhas}`;
    })
    .join("\n\n");
}

function montarMensagem({ tipo, base, dataEnvio, mesRef, observacoes }) {
  const titulo = "Atualização datas e recebimentos líquidos nos próximos 2 meses de aluguéis";
  const proximos = blocoProximos(base, dataEnvio);

  if (tipo === "semanal") return `${titulo}\n\n${proximos}`;

  const doMes = base
    .filter((r) => monthKey(r.checkin) === mesRef)
    .sort((a, b) => a.checkin.localeCompare(b.checkin));
  // soma em centavos para o total sempre bater com as linhas
  const totalCentavos = doMes.reduce((s, r) => s + Math.round(Number(r.valor_dono) * 100), 0);

  const resultado = doMes.length
    ? `${doMes.map(linhaEstadia).join("\n")}\n\nTotal líquido: ${fmtBRL(totalCentavos / 100)}`
    : "- Nenhuma estadia no período";

  const partes = [
    `RESULTADO ${nomeMes(mesRef).toUpperCase()}/${mesRef.slice(2, 4)}`,
    resultado,
    `Próximos aluguéis (recebimento líquido):\n\n${proximos}`,
  ];
  if ((observacoes || "").trim()) partes.push(`Observações:\n${observacoes.trim()}`);
  return partes.join("\n\n");
}

function SectionLabel({ children, style }) {
  return (
    <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: COLORS.tealLight, fontWeight: 700, marginBottom: 8, ...style }}>
      {children}
    </div>
  );
}

async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = texto;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

export default function RelatorioProprietarios({ properties, reservas, enviados = [], onToggleEnviado }) {
  const [tipo, setTipo] = useState("semanal");
  const [dataEnvio, setDataEnvio] = useState(hojeISO());
  const [mesRefManual, setMesRefManual] = useState("");
  const [observacoes, setObservacoes] = useState({}); // por imóvel, só na mensal
  const [aberto, setAberto] = useState(null);
  const [copiado, setCopiado] = useState("");

  const mesRef = mesRefManual || addMonths(monthKey(dataEnvio), -1);

  const imoveis = useMemo(() => {
    const nomes = new Set([...properties.map((p) => p.name), ...reservas.map((r) => r.residencia_nome)]);
    return [...nomes].filter((n) => n && !EXCLUIDOS.includes(n)).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [properties, reservas]);

  // reservas válidas por imóvel: com Valor Dono e não canceladas
  const basePorImovel = useMemo(() => {
    const m = {};
    reservas.forEach((r) => {
      if (!(Number(r.valor_dono) > 0)) return;
      if (/cancel/i.test(r.status_reserva || "")) return;
      if (!m[r.residencia_nome]) m[r.residencia_nome] = [];
      m[r.residencia_nome].push(r);
    });
    return m;
  }, [reservas]);

  const enviadoEm = useMemo(() => {
    const m = {};
    enviados.forEach((e) => { m[`${e.residencia_nome}|${e.tipo}|${e.data_envio}`] = e.enviado_em; });
    return m;
  }, [enviados]);

  const chave = (nome) => `${nome}|${tipo}|${dataEnvio}`;

  const itens = imoveis
    .map((nome) => {
      const base = basePorImovel[nome] || [];
      return {
        nome,
        base,
        enviado: enviadoEm[chave(nome)] || null,
        mensagem: montarMensagem({ tipo, base, dataEnvio, mesRef, observacoes: observacoes[nome] }),
      };
    })
    .sort((a, b) => (a.enviado ? 1 : 0) - (b.enviado ? 1 : 0)); // pendentes primeiro (ordem alfabética mantida)

  const totalEnviados = itens.filter((i) => i.enviado).length;

  const copiar = async (item) => {
    await copiarTexto(item.mensagem);
    setCopiado(item.nome);
    setTimeout(() => setCopiado((c) => (c === item.nome ? "" : c)), 2000);
  };

  const tabBtn = (id, label) => (
    <button
      onClick={() => setTipo(id)}
      style={{
        flex: 1, padding: "10px 0", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 700,
        border: `1px solid ${tipo === id ? COLORS.teal : COLORS.border}`,
        background: tipo === id ? COLORS.teal : COLORS.card,
        color: tipo === id ? "#fff" : COLORS.ink,
      }}
    >
      {label}
    </button>
  );

  const smallBtn = (extra) => ({
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 8,
    padding: "9px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", flex: 1, ...extra,
  });

  return (
    <div style={{ paddingTop: 16 }}>
      <SectionLabel>Tipo de relatório</SectionLabel>
      <div style={{ display: "flex", gap: 8 }}>
        {tabBtn("semanal", "Semanal")}
        {tabBtn("mensal", "Mensal")}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <div style={{ flex: 1 }}>
          <SectionLabel style={{ marginBottom: 4 }}>Data de envio</SectionLabel>
          <input type="date" value={dataEnvio} onChange={(e) => setDataEnvio(e.target.value || hojeISO())} style={inputStyle} />
        </div>
        {tipo === "mensal" && (
          <div style={{ flex: 1 }}>
            <SectionLabel style={{ marginBottom: 4 }}>Resultado de</SectionLabel>
            <input type="month" value={mesRef} onChange={(e) => setMesRefManual(e.target.value)} style={inputStyle} />
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: COLORS.muted }}>
        <span><b style={{ color: COLORS.ink }}>{totalEnviados}</b> de {itens.length} enviados</span>
        <span>{itens.length - totalEnviados} pendentes</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: COLORS.border, marginTop: 6, overflow: "hidden" }}>
        <div style={{ height: "100%", width: itens.length ? `${(totalEnviados / itens.length) * 100}%` : 0, background: COLORS.moss }} />
      </div>

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {itens.map((item) => {
          const expandido = aberto === item.nome;
          const semObs = tipo === "mensal" && !item.enviado && !(observacoes[item.nome] || "").trim();
          return (
            <div
              key={item.nome}
              style={{
                background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 12,
                opacity: item.enviado ? 0.75 : 1,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{item.nome}</div>
                {item.enviado ? (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: COLORS.mossBg, color: COLORS.moss, whiteSpace: "nowrap" }}>
                    Enviado {fmtEnviadoEm(item.enviado)}
                  </span>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: COLORS.amberBg, color: COLORS.amber }}>
                    Pendente
                  </span>
                )}
              </div>

              {item.base.length === 0 && (
                <div style={{ marginTop: 6, fontSize: 12, color: COLORS.amber }}>
                  Sem reservas com Valor Dono para este imóvel.
                </div>
              )}
              {semObs && (
                <div style={{ marginTop: 6, fontSize: 12, color: COLORS.amber }}>
                  Sem observações escritas (o bloco não aparece na mensagem).
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                  onClick={() => copiar(item)}
                  style={smallBtn({ background: COLORS.teal, color: "#fff", border: "none" })}
                >
                  {copiado === item.nome ? <Check size={15} /> : <Copy size={15} />}
                  {copiado === item.nome ? "Copiado" : "Copiar"}
                </button>
                {item.enviado ? (
                  <button
                    onClick={() => onToggleEnviado(item.nome, tipo, dataEnvio, false)}
                    style={smallBtn({ background: COLORS.card, color: COLORS.muted, border: `1px solid ${COLORS.border}` })}
                  >
                    <Undo2 size={15} /> Desfazer
                  </button>
                ) : (
                  <button
                    onClick={() => onToggleEnviado(item.nome, tipo, dataEnvio, true)}
                    style={smallBtn({ background: COLORS.mossBg, color: COLORS.moss, border: `1px solid ${COLORS.moss}` })}
                  >
                    <Check size={15} /> Marcar enviado
                  </button>
                )}
              </div>

              <button
                onClick={() => setAberto(expandido ? null : item.nome)}
                style={{ marginTop: 10, background: "none", border: "none", padding: 0, cursor: "pointer", color: COLORS.tealLight, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}
              >
                {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {tipo === "mensal" ? "Mensagem e observações" : "Ver mensagem"}
              </button>

              {expandido && (
                <div style={{ marginTop: 10 }}>
                  {tipo === "mensal" && (
                    <>
                      <SectionLabel style={{ marginBottom: 4 }}>Observações (escreva à mão)</SectionLabel>
                      <textarea
                        value={observacoes[item.nome] || ""}
                        onChange={(e) => setObservacoes({ ...observacoes, [item.nome]: e.target.value })}
                        rows={3}
                        placeholder="Texto pessoal para este proprietário"
                        style={{ ...inputStyle, resize: "vertical", marginBottom: 10 }}
                      />
                    </>
                  )}
                  <pre
                    style={{
                      whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, padding: 12, borderRadius: 10,
                      background: "#F7F9F6", border: `1px solid ${COLORS.border}`, fontSize: 13, lineHeight: 1.5,
                      fontFamily: "inherit", color: COLORS.ink,
                    }}
                  >
                    {item.mensagem}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {itens.length === 0 && (
        <div style={{ fontSize: 13, color: COLORS.muted, textAlign: "center", marginTop: 20 }}>
          Nenhum imóvel encontrado.
        </div>
      )}
    </div>
  );
}
