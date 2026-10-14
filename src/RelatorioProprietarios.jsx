import React, { useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";

const COLORS = {
  ink: "#16302E",
  teal: "#1F4B4A",
  tealLight: "#2E6B69",
  card: "#FFFFFF",
  border: "#D8DED6",
  rust: "#B4472C",
  rustBg: "#FBEAE5",
  amber: "#A87418",
  amberBg: "#FBF1DE",
  muted: "#6B776F",
};

const inputStyle = {
  width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`,
  fontSize: 14, fontFamily: "inherit", color: COLORS.ink, boxSizing: "border-box", background: COLORS.card,
};
const selectStyle = { ...inputStyle, appearance: "auto" };

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
  if (observacoes.trim()) partes.push(`Observações:\n${observacoes.trim()}`);
  return partes.join("\n\n");
}

function SectionLabel({ children, style }) {
  return (
    <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: COLORS.tealLight, fontWeight: 700, marginBottom: 8, ...style }}>
      {children}
    </div>
  );
}

export default function RelatorioProprietarios({ properties, reservas }) {
  const [imovel, setImovel] = useState("");
  const [tipo, setTipo] = useState("semanal");
  const [dataEnvio, setDataEnvio] = useState(hojeISO());
  const [mesRefManual, setMesRefManual] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [copiado, setCopiado] = useState(false);

  const imoveis = useMemo(() => {
    const nomes = new Set([...properties.map((p) => p.name), ...reservas.map((r) => r.residencia_nome)]);
    return [...nomes].filter((n) => n && !EXCLUIDOS.includes(n)).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [properties, reservas]);

  const mesRef = mesRefManual || addMonths(monthKey(dataEnvio), -1);

  const doImovel = useMemo(() => reservas.filter((r) => r.residencia_nome === imovel), [reservas, imovel]);
  const semValor = doImovel.length > 0 && doImovel.every((r) => !(Number(r.valor_dono) > 0));

  const base = useMemo(
    () =>
      doImovel.filter(
        (r) => Number(r.valor_dono) > 0 && !/cancel/i.test(r.status_reserva || "")
      ),
    [doImovel]
  );

  const mensagem = imovel && dataEnvio ? montarMensagem({ tipo, base, dataEnvio, mesRef, observacoes }) : "";

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensagem);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = mensagem;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
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

  return (
    <div style={{ paddingTop: 16 }}>
      <SectionLabel>Imóvel</SectionLabel>
      <select value={imovel} onChange={(e) => setImovel(e.target.value)} style={selectStyle}>
        <option value="">Selecione o imóvel</option>
        {imoveis.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>

      <SectionLabel style={{ marginTop: 16 }}>Tipo</SectionLabel>
      <div style={{ display: "flex", gap: 8 }}>
        {tabBtn("semanal", "Semanal")}
        {tabBtn("mensal", "Mensal")}
      </div>

      <SectionLabel style={{ marginTop: 16 }}>Data de envio</SectionLabel>
      <input type="date" value={dataEnvio} onChange={(e) => setDataEnvio(e.target.value)} style={inputStyle} />

      {tipo === "mensal" && (
        <>
          <SectionLabel style={{ marginTop: 16 }}>Mês de referência (resultado)</SectionLabel>
          <input type="month" value={mesRef} onChange={(e) => setMesRefManual(e.target.value)} style={inputStyle} />

          <SectionLabel style={{ marginTop: 16 }}>Observações (escreva à mão)</SectionLabel>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={4}
            placeholder="Texto pessoal para este proprietário"
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </>
      )}

      {imovel && semValor && (
        <div style={{ marginTop: 16, padding: 10, borderRadius: 8, background: COLORS.amberBg, color: COLORS.amber, fontSize: 13 }}>
          Este imóvel tem reservas, mas nenhuma com Valor Dono preenchido. Confira se a coluna foi importada.
        </div>
      )}

      {mensagem && (
        <>
          <SectionLabel style={{ marginTop: 20 }}>Mensagem pronta</SectionLabel>
          <pre
            style={{
              whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, padding: 14, borderRadius: 10,
              background: COLORS.card, border: `1px solid ${COLORS.border}`, fontSize: 13.5, lineHeight: 1.5,
              fontFamily: "inherit", color: COLORS.ink,
            }}
          >
            {mensagem}
          </pre>
          {tipo === "mensal" && !observacoes.trim() && (
            <div style={{ marginTop: 8, fontSize: 12, color: COLORS.amber }}>
              Sem observações: o bloco "Observações" não aparece na mensagem.
            </div>
          )}
          <button
            onClick={copiar}
            style={{
              marginTop: 12, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              background: COLORS.teal, color: "#fff", border: "none", borderRadius: 10, padding: "12px 16px",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}
          >
            {copiado ? <Check size={16} /> : <Copy size={16} />} {copiado ? "Copiado" : "Copiar mensagem"}
          </button>
        </>
      )}
    </div>
  );
}
