-- Controle de envio dos relatórios aos proprietários (aba Relatório).
-- Uma linha = relatório (semanal ou mensal) de um imóvel marcado como enviado em uma data.
create table if not exists relatorios_enviados (
  residencia_nome text not null,
  tipo text not null check (tipo in ('semanal', 'mensal')),
  data_envio date not null,
  enviado_em timestamptz not null default now(),
  primary key (residencia_nome, tipo, data_envio)
);
