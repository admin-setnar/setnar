import styles from '@/modules/representatives/presentation/commercial-pages/commercial-page-base.module.css';

/**
 * Static, non-interactive content widget — deliberately not a calculator or
 * simulator (CONEXAO_EXPANSAO_PLAN_V2.md §5.2 / implementation instructions
 * item 3): no product decision was made to publish exact R$/% figures on
 * this page, so there is nothing numeric for a widget here to compute.
 * Reuses the `.billCard`/`.heroFeatureList` shell every other product's
 * hero widget already renders inside (`product-widgets.tsx`), just with
 * qualitative rows instead of a number.
 *
 * No CTA here, on purpose. An earlier pass added one ("Tirar minhas
 * dúvidas") only to match the 4-WhatsApp-button structural pattern
 * `tests/e2e/commercial-pages.spec.ts` checks across the other 7 products —
 * on review, that was structural mimicry, not a UX decision: the Hero's
 * primary CTA already sits a few pixels above this card, and this widget's
 * job is to explain the three bonus types, not to open a second, redundant
 * WhatsApp launcher for the same undifferentiated intent. Per ADR-089,
 * fidelity to the other seven products' shape is not itself a requirement —
 * each Commercial Page's composition is its own. The 4-button pattern in
 * `commercial-pages.spec.ts` was adjusted to not apply here instead of
 * shaping this page around it.
 */
const PILLARS = [
  'Conexão direta — você mesmo apresenta a oportunidade.',
  'Conexão indireta — sua equipe também apresenta.',
  'Royalties — conforme sua qualificação evolui.',
] as const;

export function ExpansionHeroWidget() {
  return (
    <div className={styles.billCard}>
      <div className={styles.billHeader}>
        <span>Como você pode ser bonificado</span>
      </div>
      <ul className={styles.heroFeatureList}>
        {PILLARS.map((item) => (
          <li key={item}>
            <span className={styles.check}>✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
