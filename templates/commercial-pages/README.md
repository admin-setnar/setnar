Commercial page templates — reference only, not served code
These are the source-of-truth content/UX spec for each product's
Commercial Page, handed off as static HTML/CSS/JS with `{{TOKEN}}`
placeholders (REP_NOME, REP_ID, REP_WHATSAPP, REP_CIDADE, REP_AVATAR,
REP_PRIMEIRO_NOME, PRODUTO_SLUG, GA4_ID, LEADS_ENDPOINT, OG_IMAGE,
PAGE_URL, MSG_CONSULTOR).
They are NOT built, served, or imported by the Next.js app — Commercial
Pages will be rendered dynamically from Supabase instead of this
static-template pipeline (decision pending a full ADR in the main
README). This folder exists so the exact copy, compliance placement
(licensee identification block, LGPD notice, "not an official site"
disclaimer), bill-simulator logic, phone masking/validation, and
honeypot spam protection can be ported faithfully into React
components — diff against these files, don't invent new copy or drop
a compliance element while porting.
Do not edit these files as part of implementing the feature; if a
template itself needs a content change, that's a product decision
made here first, then ported — not the other way around.
