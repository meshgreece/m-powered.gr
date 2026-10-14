import {useRef} from 'react';
import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import HomepageLiveMap from '@site/src/components/HomepageLiveMap';

import styles from './index.module.css';

function HomepageHeader() {
  const copyRef = useRef<HTMLDivElement>(null);

  return (
    <header className={styles.hero}>
      <HomepageLiveMap copyRef={copyRef} />
      <div className={styles.heroInner}>
        <div className={styles.heroCopy} ref={copyRef}>
          <Heading as="h1" className={styles.heroTitle}>
            Ένα δίκτυο που το στήνουμε μαζί
          </Heading>
          <p className={styles.heroLead}>
            Το m-powered.gr είναι ο ανεξάρτητος ιστότοπος του Meshtastic Greece
            Community για χρήστες Meshtastic στην Ελλάδα. Βρες οδηγίες, το
            κοινοτικό προφίλ NarrowSlow και εργαλεία monitoring.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.primaryButton} href="#quick-start">
              Ξεκίνα σε 5 βήματα
            </a>
            <Link
              className={styles.secondaryButton}
              to="/docs/recommended-hardware">
              Βρες τη σωστή συσκευή
            </Link>
          </div>
          <p className={styles.heroTertiary}>
            <Link
              className={styles.tertiaryLink}
              href="https://meshview.m-powered.gr/"
              target="_blank"
              rel="noopener noreferrer">
              Δες πρόσφατα πακέτα στο Meshview
              <span aria-hidden="true">↗</span>
              <span className={styles.visuallyHidden}>
                (εξωτερικός σύνδεσμος, ανοίγει σε νέα καρτέλα)
              </span>
            </Link>
          </p>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="Meshtastic Greece Community"
      description="Το Meshtastic Greece Community είναι μια ανεξάρτητη κοινότητα χρηστών Meshtastic στην Ελλάδα. Οδηγοί, προφίλ NarrowSlow και εργαλεία monitoring στο m-powered.gr.">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
