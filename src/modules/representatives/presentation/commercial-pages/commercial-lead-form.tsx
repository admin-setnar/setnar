'use client';

import { useState } from 'react';

import { phoneFieldHint, maskPhone, validaTelefone } from '@/modules/representatives/presentation/commercial-pages/br-phone-field';
import styles from '@/modules/representatives/presentation/commercial-pages/commercial-page-base.module.css';
import { LEAD_HONEYPOT_FIELD } from '@/modules/leads/domain/lead-rules';

/**
 * Ported from `.lead-form-card`/`.lead-form` in every template
 * (`templates/commercial-pages/ConexaoGreen/index.html:158-190`, byte-identical
 * across all 7 except which product-specific field a couple of them added —
 * kept out here on purpose, see the 2026-08-13 decision to run one shared
 * field set everywhere rather than extend `submit_lead`'s fixed parameter
 * list for a 5th, per-product field). Still posts through the existing
 * `/api/leads` contract (`app/api/leads/route.ts`) — this rewrite changes
 * how the page looks, not how a lead reaches the database.
 *
 * `disabled` (SET-36): true only from the preview route, matching the old
 * `LeadForm`'s own reasoning — `/api/leads` resolves the destination
 * Representative from the request's `Host` header, which the preview never
 * matches, so a real submission from there would always 404.
 */
export function CommercialLeadForm({
  productSlug,
  representativeId,
  title,
  description,
  submitLabel,
  privacyNote,
  successDescription,
  disabled = false,
}: {
  productSlug: string;
  representativeId: string;
  title: string;
  description: string;
  submitLabel: string;
  privacyNote: string;
  successDescription: string;
  disabled?: boolean;
}) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cidade, setCidade] = useState('');
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const hint = phoneFieldHint(telefone);
  const fieldClass = !phoneTouched
    ? styles.leadField
    : hint.state === 'valid'
      ? `${styles.leadField} ${styles.fieldValid}`
      : hint.state === 'invalid'
        ? `${styles.leadField} ${styles.fieldInvalid}`
        : styles.leadField;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPhoneTouched(true);

    const phone = validaTelefone(telefone);
    if (!phone.ok) return;

    // Honeypot tripped: respond exactly like success, never call the API —
    // matches every template's own `if(dados.empresa){ window.location.href = '/obrigado.html'; return; }`.
    if (honeypot) {
      setStatus('success');
      return;
    }

    setStatus('sending');
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          telefone,
          cidade,
          email,
          [LEAD_HONEYPOT_FIELD]: honeypot,
          productSlug,
          origem: 'commercial_page',
        }),
      });
      if (!response.ok) {
        setStatus('error');
        return;
      }
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className={styles.leadFormCard} style={{ gridTemplateColumns: '1fr' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Recebemos seus dados</h2>
          <p>{successDescription}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.leadFormCard}>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <form
        className={styles.leadForm}
        name={`lead-${productSlug}-${representativeId}`}
        method="POST"
        noValidate
        onSubmit={handleSubmit}
      >
        <p className={styles.hpField} aria-hidden="true">
          <label>
            Não preencha isto:{' '}
            <input
              name={LEAD_HONEYPOT_FIELD}
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(event) => setHoneypot(event.target.value)}
            />
          </label>
        </p>

        <div className={styles.leadField}>
          <label htmlFor="lead-nome">Nome</label>
          <input
            type="text"
            id="lead-nome"
            name="nome"
            required
            autoComplete="name"
            placeholder="Seu nome"
            disabled={disabled || status === 'sending'}
            value={nome}
            onChange={(event) => setNome(event.target.value)}
          />
        </div>

        <div className={fieldClass}>
          <label htmlFor="lead-telefone">Telefone</label>
          <input
            type="tel"
            id="lead-telefone"
            name="telefone"
            required
            autoComplete="tel"
            inputMode="tel"
            placeholder="(11) 98888-7777"
            maxLength={16}
            pattern="\(\d{2}\)\s\d{4,5}-\d{4}"
            title="Formato: (11) 98888-7777"
            aria-describedby="telefone-hint"
            disabled={disabled || status === 'sending'}
            value={telefone}
            onChange={(event) => {
              setTelefone(maskPhone(event.target.value));
              setPhoneTouched(true);
            }}
          />
          <p className={styles.fieldHint} id="telefone-hint" aria-live="polite">
            {phoneTouched ? hint.message : ''}
          </p>
        </div>

        <div className={styles.leadField}>
          <label htmlFor="lead-cidade">
            Cidade / Estado <span className={styles.opcional}>(opcional)</span>
          </label>
          <input
            type="text"
            id="lead-cidade"
            name="cidade"
            autoComplete="address-level2"
            placeholder="Ex: Curitiba/PR"
            disabled={disabled || status === 'sending'}
            value={cidade}
            onChange={(event) => setCidade(event.target.value)}
          />
        </div>

        <div className={styles.leadField}>
          <label htmlFor="lead-email">
            E-mail <span className={styles.opcional}>(opcional)</span>
          </label>
          <input
            type="email"
            id="lead-email"
            name="email"
            autoComplete="email"
            placeholder="seu@email.com"
            disabled={disabled || status === 'sending'}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <button type="submit" className={`${styles.btnWhats} ${styles.leadSubmit}`} disabled={disabled || status === 'sending'}>
          {submitLabel}
        </button>
        <p className={styles.leadStatus} role="status" aria-live="polite">
          {status === 'sending' ? 'Enviando...' : ''}
          {status === 'error' ? (
            <span style={{ color: '#B33A3A' }}>Não foi possível enviar agora. Tente novamente em instantes.</span>
          ) : null}
        </p>
        <p className={styles.leadPrivacy}>{privacyNote}</p>
        {disabled ? (
          <p className={styles.leadPrivacy}>Formulário desativado na prévia — publique a página para receber contatos reais.</p>
        ) : null}
      </form>
    </div>
  );
}
