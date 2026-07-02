import Link from "next/link";
import styles from "./dashboard-view.module.css";

export function ComingSoonPage({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <main className={styles.page}>
      <section className={`proof-board-section ${styles.board}`}>
        <div className="board-tab">COMING SOON</div>
        <div className={styles.emptyPanel}>
          <p className={styles.emptyEyebrow}>{eyebrow}</p>
          <h1 className={styles.emptyTitle}>{title}</h1>
          <p className={styles.emptyText}>{description}</p>
          <Link className={`${styles.ghostButton} ${styles.emptyAction}`} href="/dashboard">
            Back to Agent Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
