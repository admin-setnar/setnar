import local from '@/modules/representatives/presentation/commercial-pages/conexao-expansao/conexao-expansao.module.css';

/**
 * The 5 main qualification tiers only — no Pré-Sênior/Pré-Gestor/etc., no
 * PML, no point thresholds (CONEXAO_EXPANSAO_PLAN_V2.md §5.7 and
 * implementation instructions item 11: those are regulation detail, not a
 * first-visit commercial explanation). A horizontal strip on desktop,
 * a vertical list on mobile — CSS handles the switch, no JS/state needed.
 */
const TIERS = ['Sênior', 'Gestor', 'Executivo', 'Diretor', 'Acionista'] as const;

export function CareerLadderStrip() {
  return (
    <ol className={local.ladderStrip}>
      {TIERS.map((tier, index) => (
        <li className={local.ladderStep} key={tier}>
          <span className={local.ladderStepLabel}>{tier}</span>
          {index < TIERS.length - 1 ? (
            <span className={local.ladderArrow} aria-hidden="true">
              →
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
