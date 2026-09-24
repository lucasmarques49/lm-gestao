import { supabase } from "./supabaseClient";

/* ---------------- IMÓVEIS ---------------- */

export async function fetchProperties() {
  const { data, error } = await supabase
    .from("imoveis")
    .select("*, enxoval_itens(*), comodos(*, comodo_itens(*))")
    .order("nome");
  if (error) throw error;
  return data.map((p) => ({
    id: p.id,
    name: p.nome,
    address: p.endereco || "",
    linenItems: (p.enxoval_itens || []).map((i) => ({
      id: i.id,
      label: i.label,
      expected: i.quantidade_esperada,
    })),
    rooms: (p.comodos || []).map((r) => ({
      id: r.id,
      name: r.nome,
      items: (r.comodo_itens || []).map((it) => ({ id: it.id, label: it.label })),
    })),
  }));
}

export async function saveProperty(p) {
  const isNew = String(p.id).length < 30 || !p.id.includes("-"); // ids gerados no front (uid()) não são uuid
  const payload = { nome: p.name, endereco: p.address };
  let imovelId = p.id;

  if (isNew) {
    const { data, error } = await supabase.from("imoveis").insert(payload).select().single();
    if (error) throw error;
    imovelId = data.id;
  } else {
    const { error } = await supabase.from("imoveis").update(payload).eq("id", p.id);
    if (error) throw error;
  }

  // substitui enxoval_itens
  await supabase.from("enxoval_itens").delete().eq("imovel_id", imovelId);
  if (p.linenItems.length) {
    const { error } = await supabase.from("enxoval_itens").insert(
      p.linenItems.map((i) => ({ imovel_id: imovelId, label: i.label, quantidade_esperada: i.expected }))
    );
    if (error) throw error;
  }

  // substitui cômodos (cascade apaga comodo_itens)
  await supabase.from("comodos").delete().eq("imovel_id", imovelId);
  for (const room of p.rooms) {
    if (!room.name.trim()) continue;
    const { data: comodo, error: cErr } = await supabase
      .from("comodos")
      .insert({ imovel_id: imovelId, nome: room.name })
      .select()
      .single();
    if (cErr) throw cErr;
    const validItems = room.items.filter((it) => it.label.trim());
    if (validItems.length) {
      const { error: iErr } = await supabase
        .from("comodo_itens")
        .insert(validItems.map((it) => ({ comodo_id: comodo.id, label: it.label })));
      if (iErr) throw iErr;
    }
  }
  return imovelId;
}

export async function deleteProperty(id) {
  const { error } = await supabase.from("imoveis").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- FUNCIONÁRIAS ---------------- */

export async function fetchStaff() {
  const { data, error } = await supabase.from("funcionarias").select("*").order("nome");
  if (error) throw error;
  return data.map((s) => ({ id: s.id, name: s.nome }));
}

export async function addStaff(name) {
  const { error } = await supabase.from("funcionarias").insert({ nome: name });
  if (error) throw error;
}

export async function removeStaff(id) {
  const { error } = await supabase.from("funcionarias").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- SESSÕES (histórico) ---------------- */

export async function fetchSessions() {
  const { data, error } = await supabase
    .from("sessoes_limpeza")
    .select("*, imoveis(nome), sessao_enxoval_resultados(*), sessao_comodo_resultados(*)")
    .order("iniciado_em", { ascending: false })
    .limit(200);
  if (error) throw error;

  return data.map((s) => {
    const roomsMap = {};
    (s.sessao_comodo_resultados || []).forEach((r) => {
      if (!roomsMap[r.comodo_nome]) roomsMap[r.comodo_nome] = { id: r.comodo_nome, name: r.comodo_nome, items: [] };
      roomsMap[r.comodo_nome].items.push({
        id: r.id, label: r.item_label, status: r.status, desc: r.descricao || "", mediaUrl: r.midia_url || "",
      });
    });
    return {
      id: s.id,
      propertyName: s.imoveis?.nome || "Imóvel removido",
      staffName: s.funcionaria_nome,
      startedAt: s.iniciado_em,
      finalVideoUrl: s.video_final_url || "",
      linen: (s.sessao_enxoval_resultados || []).map((l) => ({
        id: l.id, label: l.label, expected: l.quantidade_esperada, actual: l.quantidade_contada,
        damaged: l.avariado, damageDesc: l.descricao_avaria || "", damageMediaUrl: l.midia_url || "",
      })),
      rooms: Object.values(roomsMap),
    };
  });
}

export async function saveSession(session) {
  const { data: sessao, error } = await supabase
    .from("sessoes_limpeza")
    .insert({
      imovel_id: session.propertyId,
      funcionaria_nome: session.staffName,
      iniciado_em: session.startedAt,
      finalizado_em: new Date().toISOString(),
      video_final_url: session.finalVideoUrl || null,
    })
    .select()
    .single();
  if (error) throw error;
  const sessaoId = sessao.id;

  if (session.linen.length) {
    const { error: lErr } = await supabase.from("sessao_enxoval_resultados").insert(
      session.linen.map((l) => ({
        sessao_id: sessaoId,
        label: l.label,
        quantidade_esperada: l.expected,
        quantidade_contada: l.actual,
        avariado: l.damaged,
        descricao_avaria: l.damageDesc || null,
        midia_url: l.damageMediaUrl || null,
      }))
    );
    if (lErr) throw lErr;
  }

  const roomResults = session.rooms.flatMap((r) =>
    r.items.map((i) => ({
      sessao_id: sessaoId,
      comodo_nome: r.name,
      item_label: i.label,
      status: i.status,
      descricao: i.desc || null,
      midia_url: i.mediaUrl || null,
    }))
  );
  if (roomResults.length) {
    const { error: rErr } = await supabase.from("sessao_comodo_resultados").insert(roomResults);
    if (rErr) throw rErr;
  }

  // gera itens de manutenção automaticamente a partir dos problemas encontrados
  const maintenanceEntries = [];
  session.linen.forEach((l) => {
    if (l.damaged) {
      maintenanceEntries.push({
        imovel_id: session.propertyId,
        sessao_id: sessaoId,
        origem: "checklist",
        titulo: `Enxoval: ${l.label}`,
        descricao: l.damageDesc || null,
        prioridade: "media",
        status: "aberto",
        reportado_por: session.staffName,
        midia_url: l.damageMediaUrl || null,
      });
    }
  });
  session.rooms.forEach((r) => {
    r.items.forEach((i) => {
      if (i.status === "erro") {
        maintenanceEntries.push({
          imovel_id: session.propertyId,
          sessao_id: sessaoId,
          origem: "checklist",
          titulo: `${r.name}: ${i.label}`,
          descricao: i.desc || null,
          prioridade: "media",
          status: "aberto",
          reportado_por: session.staffName,
          midia_url: i.mediaUrl || null,
        });
      }
    });
  });
  if (maintenanceEntries.length) {
    const { error: mErr } = await supabase.from("manutencao").insert(maintenanceEntries);
    if (mErr) throw mErr;
  }

  return sessaoId;
}

/* ---------------- MANUTENÇÃO ---------------- */

export async function fetchMaintenance() {
  const { data, error } = await supabase
    .from("manutencao")
    .select("*, imoveis(nome)")
    .order("status", { ascending: true })
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return data.map((m) => ({
    id: m.id,
    propertyName: m.imoveis?.nome || "Imóvel removido",
    origem: m.origem,
    titulo: m.titulo,
    descricao: m.descricao || "",
    prioridade: m.prioridade,
    status: m.status,
    reportadoPor: m.reportado_por || "",
    midiaUrl: m.midia_url || "",
    criadoEm: m.criado_em,
    resolvidoEm: m.resolvido_em,
  }));
}

export async function addManualMaintenance(entry) {
  const { error } = await supabase.from("manutencao").insert({
    imovel_id: entry.propertyId,
    origem: "manual",
    titulo: entry.titulo,
    descricao: entry.descricao || null,
    prioridade: entry.prioridade,
    status: "aberto",
    reportado_por: entry.reportadoPor || null,
    midia_url: entry.midiaUrl || null,
  });
  if (error) throw error;
}

export async function setMaintenanceStatus(id, status) {
  const { error } = await supabase
    .from("manutencao")
    .update({ status, resolvido_em: status === "resolvido" ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
}

/* ---------------- MÍDIA (fotos/vídeos) ---------------- */

export async function uploadMedia(file) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from("checklist-midia").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("checklist-midia").getPublicUrl(path);
  return data.publicUrl;
}

export async function fetchReservas() {
  const { data, error } = await supabase
    .from("reservas")
    .select("*")
    .order("checkin", { ascending: true });
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    residencia_nome: r.residencia_nome,
    hospede_nome: r.hospede_nome || "",
    hospede_celular: r.hospede_celular || "",
    checkin: r.checkin,
    checkout: r.checkout,
    plataforma: r.plataforma || "",
    status_reserva: r.status_reserva,
    documento_enviado: r.documento_enviado,
    origem: r.origem,
  }));
}
 
export async function saveReserva(dados) {
  const { error } = await supabase.from("reservas").insert({
    residencia_nome: dados.residencia_nome,
    hospede_nome: dados.hospede_nome || null,
    checkin: dados.checkin,
    checkout: dados.checkout,
    plataforma: dados.plataforma || null,
    status_reserva: "Futura",
    origem: "manual",
  });
  if (error) throw error;
}
 
export async function setDocumentoEnviado(id, valor) {
  const { error } = await supabase
    .from("reservas")
    .update({ documento_enviado: valor })
    .eq("id", id);
  if (error) throw error;
}
