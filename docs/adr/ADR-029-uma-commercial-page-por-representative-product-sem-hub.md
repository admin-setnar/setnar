### ADR-029 — Uma Commercial Page por (Representative × Product); sem hub público — o hub é o `/app` privado
**Decisão.** Cada produto ativado tem sua própria página
(`<slug>.setnar.com/<produto>`), não uma página unificada — confirmado
pelos 7 templates de origem em `templates/commercial-pages/`
(ConexaoClub, ConexaoGreen, ConexaoLivre, ConexaoPlacas, ConexaoSolar,
GreenSeguros, Telecom), cada um falando de um produto só. O "hub" de
gerenciamento (links ativos, cliques, KPIs) vive no `/app` autenticado,
não numa página pública no root do subdomínio — `docs/ROADMAP.md` já
separa isso em dois recursos distintos do Stage 1 ("Commercial Pages",
linha 119, vs. "Dashboard", linha 145) — essa decisão só confirma o que
já estava implícito. **Consequência.** `/app`
(`src/app/app/page.tsx`, 53 linhas), hoje um stub mínimo (Sprint B), é o
lugar natural pra crescer — inclusive é onde `DOMAIN_MODEL.md`'s "AI
Content Suggestion Service" (Stage 4, linha 605) vai precisar viver,
quando existir: superfície autenticada, com acesso agregado a
KPIs/analytics/páginas ativas, já é o desenho certo sem construir nada
de IA agora. **Custo de reversão.** Baixo — nenhuma URL pública depende
dessa escolha.
