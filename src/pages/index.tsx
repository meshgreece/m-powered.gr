import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';

import styles from './index.module.css';

const firstSteps = [
  {
    title: 'Διάλεξε σωστή συσκευή',
    description: 'Πρώτα βεβαιώσου ότι η συσκευή είναι 868MHz.',
    to: '/docs/recommended-hardware',
    label: 'Προτεινόμενο υλικό',
  },
  {
    title: 'Στήσε σωστά τον πρώτο κόμβο',
    description:
      'Βάλε region EU_868, ρόλο CLIENT και hop limit 3 ή 4. Τα υπόλοιπα μπορούν να περιμένουν.',
    to: '/docs/get-started',
    label: 'Οδηγός εκκίνησης',
  },
  {
    title: 'Αν κολλήσεις, ξεκίνα από εδώ',
    description:
      'Χάρτης, Meshview και Malla μπορούν να σε βοηθήσουν να δεις τι συμβαίνει και να ζητήσεις βοήθεια πιο εύκολα αν χρειαστεί.',
    to: '/docs/community-tools',
    label: 'Εργαλεία κοινότητας',
  },
];

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();

  return (
    <header className={styles.heroBanner}>
      <div className={clsx('container', styles.heroLayout)}>
        <div className={styles.heroCopy}>
          <Heading as="h1" className={styles.heroTitle}>
            {siteConfig.title}
          </Heading>
          <p className={styles.heroTagline}>{siteConfig.tagline}</p>
          <p className={styles.heroLead}>
            Εδώ θα βρεις τα βασικά για να μπεις στο ελληνικό mesh χωρίς να
            χαθείς στα settings. Τι συσκευή να πάρεις, πώς να στήσεις τον
            πρώτο κόμβο και πού να κοιτάξεις όταν κάτι δεν σου βγαίνει.
          </p>
          <div className={styles.heroActions}>
            <Link
              className={clsx('button button--lg', styles.primaryButton)}
              to="/docs/get-started">
              Ξεκίνα από τον οδηγό
            </Link>
            <Link
              className={clsx('button button--lg', styles.secondaryButton)}
              to="/docs/recommended-hardware">
              Δες προτεινόμενο υλικό
            </Link>
          </div>
        </div>

        <aside className={styles.heroPanel}>
          <Heading as="h2" className={styles.heroPanelTitle}>
            Αν ξεκινάς σήμερα
          </Heading>
          <ol className={styles.heroSteps}>
            {firstSteps.map((step) => (
              <li key={step.title} className={styles.heroStep}>
                <div>
                  <p className={styles.heroStepTitle}>{step.title}</p>
                  <p className={styles.heroStepDescription}>{step.description}</p>
                </div>
                <Link className={styles.heroStepLink} to={step.to}>
                  {step.label}
                </Link>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="Η ελληνική κοινότητα Meshtastic"
      description="Οδηγοί, εργαλεία και πρακτική βοήθεια για Meshtastic στην Ελλάδα.">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
