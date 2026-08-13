import type { ReactNode } from 'react';

import styles from '@/modules/representatives/presentation/commercial-pages/commercial-page-base.module.css';

export function CheckedListSection({ id, title, intro, items, icons, alt = false }: { id?: string; title: string; intro: string; items: readonly ReactNode[]; icons?: readonly string[]; alt?: boolean }) {
  return <section id={id} className={alt ? styles.sectionAlt : undefined}><div className={styles.container}><div className={styles.sectionHead}><h2>{title}</h2><p>{intro}</p></div><ul className={styles.eligList}>{items.map((item,index)=><li key={index}><span className={styles.check} aria-hidden="true">{icons?.[index] ?? '✓'}</span><span>{item}</span></li>)}</ul></div></section>;
}

export function CardsSection({ id, title, intro, children, alt = false }: { id?: string; title: string; intro: string; children: ReactNode; alt?: boolean }) {
  return <section id={id} className={alt ? styles.sectionAlt : undefined}><div className={styles.container}><div className={styles.sectionHead}><h2>{title}</h2><p>{intro}</p></div>{children}</div></section>;
}

export function LeadSection({ children }: { children: ReactNode }) {
  return <section id="quero-simular"><div className={styles.container}>{children}</div></section>;
}
