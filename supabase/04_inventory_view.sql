-- ============================================================================
-- MEDVORA — INVENTORY VIEW (Phase 1, add-on)
-- ============================================================================
-- Ku shub KADIB 01–03. Wuxuu isu geeyaa (SUM) dhammaan stock_batches si loo
-- helo immisa hadda ka jirta alaab kasta branch kasta — halkii aad row-row
-- ahaan u eegi lahayd batches-ka gaarka ah.
--
-- security_invoker = true waa qodob MUHIIM AH: micnaheedu waa in RLS-ka
-- jaduallada hoose (stock_batches, products, branches) lagu fulinayo
-- xuquuqda user-ka soo weydiinaya, ma aha kan sameeyay view-ga. Iyada oo
-- aan taasi la darin, view-gu wuxuu u dhaqmi lahaa sidii admin, taasi oo
-- jabin lahayd tenant isolation-ka.
-- ============================================================================

create or replace view stock_levels
with (security_invoker = true)
as
select
  sb.organization_id,
  sb.branch_id,
  b.name as branch_name,
  sb.product_id,
  p.name as product_name,
  p.reorder_level,
  p.unit,
  sum(sb.quantity) as quantity_on_hand,
  min(sb.expiry_date) filter (where sb.expiry_date is not null) as nearest_expiry
from stock_batches sb
join products p on p.id = sb.product_id
join branches b on b.id = sb.branch_id
group by sb.organization_id, sb.branch_id, b.name, sb.product_id, p.name,
         p.reorder_level, p.unit;