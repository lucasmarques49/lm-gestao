-- Valor líquido do proprietário por reserva (coluna "Valor Dono" da planilha).
-- Usado pela aba Relatório. Reservas sem repasse (ex.: imóveis dos sócios) ficam null ou 0.
alter table reservas add column if not exists valor_dono numeric(12,2);
