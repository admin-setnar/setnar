/**
 * Fontes da identidade Conexão Green — Archivo Black, Space Grotesk e
 * JetBrains Mono, as mesmas da peça de referência aprovada
 * (poster-qrcode-conexaogreen.html).
 *
 * Self-hospedadas via @fontsource (arquivos woff2 empacotados pelo Vite) em
 * vez de @import remoto do Google Fonts: o ambiente de build/preview deste
 * projeto não tem acesso de rede a fonts.googleapis.com, e uma futura
 * renderização server-side (ex.: geração de PNG) provavelmente também não
 * teria. Guideline do projeto (seção 17): evitar fontes remotas frágeis
 * quando isso pode prejudicar a renderização.
 */
import '@fontsource/archivo-black'; // peso único (400) — headline
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
