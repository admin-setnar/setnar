Commercial page templates — reference only, not served code
These are the source-of-truth content/UX spec for each product's
Commercial Page, handed off as static HTML/CSS/JS with `{{TOKEN}}`
placeholders (REP_NOME, REP_ID, REP_WHATSAPP, REP_CIDADE,
REP_PRIMEIRO_NOME, PRODUTO_SLUG, GA4_ID, LEADS_ENDPOINT, OG_IMAGE,
PAGE_URL, MSG_CONSULTOR). REP_AVATAR was dropped from the consultor
block — out of scope for MVP; do not reintroduce without a product
decision.
They are NOT built, served, or imported by the Next.js app — Commercial
Pages are rendered by Next.js as seven independent product presentation
trees selected dynamically by slug (ADR-089), rather than by this static
template pipeline. This folder exists so the exact copy, compliance placement
(licensee identification block, LGPD notice, "not an official site"
disclaimer), bill-simulator logic, phone masking/validation, and
honeypot spam protection can be ported faithfully into React
trees — diff each product directly against its reference, don't invent new copy or drop
a compliance element while porting.
Do not edit these files as part of implementing the feature; if a
template itself needs a content change, that's a product decision
made here first, then ported — not the other way around.
