import styles from '@/modules/representatives/presentation/commercial-pages/commercial-page-base.module.css';

/** Ported from `.trust-strip` — identical structure across all 7 templates. */
export function TrustStrip({ points }: { points: readonly string[] }) {
  return (
    <div className={styles.trustStrip}>
      <div className={styles.container}>
        {points.map((point) => (
          <span key={point}>{point}</span>
        ))}
      </div>
    </div>
  );
}
