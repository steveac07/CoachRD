-- =====================================================================
-- CoachRD · Estado «archived» para los planes
-- Al aprobar un plan nuevo, el aprobado anterior pasa a archived: el socio
-- (y su lista de compra) siempre tiene un único plan vigente.
-- Va en su propia migración: Postgres no permite usar un valor de enum en
-- la misma transacción en la que se añade.
-- =====================================================================

alter type public.plan_status add value if not exists 'archived';
