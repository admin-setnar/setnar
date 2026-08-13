import type { ReactNode } from 'react';

import styles from '@/modules/representatives/presentation/commercial-pages/commercial-page-base.module.css';

export interface CommercialFaqItem {
  readonly question: string;
  readonly answer: ReactNode;
}

/** Ported from `#faq`'s `<details>` pattern — identical across all 7 templates. */
export function FaqSection({
  title = 'Perguntas frequentes',
  intro,
  items,
  alt = false,
}: {
  title?: string;
  intro: string;
  items: readonly CommercialFaqItem[];
  /** Some templates alternate `.section-alt` background on the FAQ section, some don't. */
  alt?: boolean;
}) {
  return (
    <section id="faq" className={alt ? styles.sectionAlt : undefined}>
      <div className={styles.container}>
        <div className={styles.sectionHead}>
          <h2>{title}</h2>
          <p>{intro}</p>
        </div>
        <div className={styles.faq}>
          {items.map((item) => (
            <details className={styles.faqItem} key={item.question}>
              <summary>
                {item.question}
                <span className={styles.faqIcon} aria-hidden="true">
                  +
                </span>
              </summary>
              <div className={styles.faqAnswer}>
                {typeof item.answer === 'string' ? <p>{item.answer}</p> : item.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
