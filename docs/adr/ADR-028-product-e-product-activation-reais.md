### ADR-028 — Product e Product Activation reais; Catalog fica conceitual, não uma tabela própria
**Decisão.** `products` (`company_id`, `slug`, `name`) e
`product_activations` (`representative_id`, `product_id`, `status`
draft/published/unpublished —
`supabase/migrations/20260731000000_create_representative_domain.sql:204-240`)
— o ciclo de vida de publicação da página vive na mesma linha da
Activation, não em duas tabelas separadas. **Por quê não uma tabela
`catalogs` literal.** Com uma Company só, um Catalog por Company é
exatamente `products.company_id` — uma tabela `catalogs` seria uma
tabela de uma linha, sem comportamento próprio. Generalizar isso agora
seria a categoria exata de complexidade prematura que o projeto evita
até validar um segundo nicho/Company. **Custo de reversão.** Baixo para
separar `catalogs` depois, se um dia uma segunda Company existir.
