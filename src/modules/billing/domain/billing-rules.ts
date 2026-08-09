/** Só dígitos, 11 (CPF) ou 14 (CNPJ) — validação de formato, não de dígito
 * verificador: o Asaas já valida o documento de verdade e devolve
 * `invalid_document` tipado quando reprovar (ver `map-asaas-error.ts`).
 * Checar o dígito verificador aqui seria duplicar uma validação que o
 * gateway já faz com autoridade — YAGNI.
 */
export const DOCUMENT_ID_PATTERN = /^\d{11}$|^\d{14}$/;

/**
 * CEP — só dígitos, 8 posições. Exigido pelo Asaas para criar um customer
 * apto a cobrança recorrente (`chargeTypes: ['RECURRENT']`, ver
 * `asaas-payment-gateway.ts`): sem `postalCode`/`addressNumber` no customer,
 * a criação do Checkout falha com `invalid_object` pedindo endereço
 * completo. Enviando só CEP + número, o próprio Asaas resolve
 * logradouro/bairro/cidade/UF — não é preciso pedir esses campos aqui
 * (achado testando o checkout real contra o Sandbox).
 */
export const POSTAL_CODE_PATTERN = /^\d{8}$/;

export function stripNonDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Copy de marketing para o botão de checkout — não é o valor cobrado de
 * verdade, que é decidido e devolvido só por `reserve_billing_checkout_slot()`
 * (migration `20260824000000`), nunca por uma constante no lado
 * TypeScript (`BILLING_DECISIONS_PLAN.md` §6.2). Mostrar o valor real
 * ANTES da submissão exigiria reservar a vaga só para exibir o preço, o que
 * consumiria uma vaga de lançamento pela simples visita à página — por
 * isso este texto é só copy, e pode ficar desatualizado se as vagas se
 * esgotarem e um preço diferente entrar em vigor. Corrigir isso é escopo de
 * SET-31, quando a página passar a mostrar o `amount_cents` real já
 * gravado na própria linha do representante autenticado.
 */
export const LAUNCH_PRICE_LABEL = 'R$ 27,90/mês';
