import type { ReactNode } from 'react';

import styles from '@/modules/representatives/presentation/commercial-pages/commercial-page-base.module.css';

export interface CommercialStep {
  readonly title: string;
  readonly description: string;
}

/** Ported from `#como-funciona` — identical structure across all 7 templates. */
export function StepsSection({
  id = 'como-funciona',
  title,
  intro,
  steps,
  alt = false,
  showNumbers = true,
  after,
}: {
  id?: string;
  title: string;
  intro: string;
  steps: readonly CommercialStep[];
  alt?: boolean;
  showNumbers?: boolean;
  after?: ReactNode;
}) {
  return (
    <section id={id} className={alt ? styles.sectionAlt : undefined}>
      <div className={styles.container}>
        <div className={styles.sectionHead}>
          <h2>{title}</h2>
          {intro ? <p>{intro}</p> : null}
        </div>
        <div className={styles.steps}>
          {steps.map((step, index) => (
            <div className={styles.stepCard} key={step.title}>
              {showNumbers ? <div className={styles.stepNum} aria-hidden="true">{index + 1}</div> : null}
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
          ))}
        </div>
        {after}
      </div>
    </section>
  );
}
