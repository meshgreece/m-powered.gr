import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const TELEGRAM_URL = 'https://t.me/+_5Z0q7DWM6UwMDJk';

const quickStartSteps = [
  {
    title: 'Φόρτωσε το firmware',
    description:
      'Σύνδεσε τη συσκευή με USB και φόρτωσε το επίσημο firmware του Meshtastic από τον Web Flasher.',
    to: 'https://flash.meshtastic.org/',
    label: 'Άνοιξε τον Web Flasher',
  },
  {
    title: 'Κάνε τις βασικές ρυθμίσεις',
    description:
      'Σύνδεσε τη συσκευή στην εφαρμογή, δώσε της ένα όνομα και έλεγξε το βασικό κανάλι.',
    to: 'https://meshtastic.org/docs/software/',
    label: 'Δες τις εφαρμογές',
  },
  {
    title: 'Στείλε ένα «γεια»',
    description:
      'Γράψε ένα «γεια» στο βασικό κανάλι και στείλε το πρώτο σου μήνυμα.',
    to: '/docs/get-started#δοκίμασέ-το',
    label: 'Δες πώς γίνεται η δοκιμή',
  },
  {
    title: 'Δες αν έφτασε',
    description:
      'Αν το μήνυμα φτάσει στο Meshview, θα το δεις στη ζωντανή ροή — και στον χάρτη πιο πάνω.',
    to: 'https://meshview.m-powered.gr/firehose',
    label: 'Άνοιξε τη ζωντανή ροή',
  },
  {
    title: 'Έλα στην κοινότητα',
    description:
      'Πες μας από πού είσαι, γνώρισε τους υπόλοιπους και ρώτησε ό,τι σε δυσκολεύει.',
    to: TELEGRAM_URL,
    label: 'Μπες στο Telegram',
  },
];

const nodeGuides = [
  {
    title: 'Προσωπικός κόμβος',
    description:
      'Για την τσέπη, το αυτοκίνητο ή το σπίτι. Απλό στήσιμο για καθημερινή χρήση.',
    to: '/docs/personal-node',
    accent: styles.accentBlue,
  },
  {
    title: 'Σταθερός κόμβος',
    description:
      'Για ένα μόνιμο σημείο που βοηθά το δίκτυο να φτάσει πιο μακριά.',
    to: '/docs/fixed-nodes-backbone',
    accent: styles.accentOrange,
  },
];

const networkTools = [
  {
    title: 'Χάρτης κόμβων',
    description: 'Δες ποιοι κόμβοι υπάρχουν κοντά σου.',
    to: 'https://map.m-powered.gr/',
    label: 'Άνοιξε τον χάρτη',
  },
  {
    title: 'Meshview',
    description: 'Δες ζωντανά την κίνηση και ποιοι κόμβοι ακούγονται.',
    to: 'https://meshview.m-powered.gr/',
    label: 'Άνοιξε το Meshview',
  },
  {
    title: 'Malla',
    description:
      'Δες αναλυτικά δεδομένα, διαδρομές και συνδέσεις του δικτύου.',
    to: 'https://malla.m-powered.gr/',
    label: 'Άνοιξε το Malla',
  },
];

const iconProps = {
  width: 15,
  height: 15,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const;

const communityLinks = [
  {
    label: 'Telegram',
    to: TELEGRAM_URL,
    icon: <path d="M21 4 3 11l5 2 2 6 3-4 5 3z" />,
  },
  {
    label: 'Ενημερώσεις',
    to: '/blog',
    icon: (
      <>
        <path d="M5 9h3l7-4v14l-7-4H5z" />
        <path d="M18 9a3.5 3.5 0 0 1 0 6" />
      </>
    ),
  },
  {
    label: 'GitHub',
    to: 'https://github.com/meshgreece/m-powered.gr',
    icon: <path d="m9 8-5 4 5 4M15 8l5 4-5 4" />,
  },
  {
    label: 'Συχνές ερωτήσεις',
    to: '/docs/faq',
    icon: (
      <>
        <path d="M9.2 9a2.9 2.9 0 1 1 4 2.7c-.8.4-1.2 1-1.2 1.8v.5" />
        <path d="M12 17.5h.01" />
      </>
    ),
  },
];

function SectionIntro({title, children}: {title: string; children: ReactNode}) {
  return (
    <div className={styles.sectionIntro}>
      <Heading as="h2" className={styles.sectionTitle}>
        {title}
      </Heading>
      <p className={styles.sectionDescription}>{children}</p>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <div className={styles.sections}>
      <section className={clsx(styles.band, styles.hub, styles.quickStart)}
        id="quick-start">
        <div className={styles.inner}>
          <SectionIntro title="Από το κουτί στο πρώτο «γεια»">
            Πέντε βήματα για να στήσεις τον κόμβο σου και να στείλεις το πρώτο
            σου μήνυμα.
          </SectionIntro>
          <ol className={styles.steps}>
            {quickStartSteps.map((step, index) => (
              <li className={styles.step} key={step.title}>
                <div className={styles.stepMarker}>
                  <span className={styles.stepNumber} aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className={styles.stepLine} />
                </div>
                <div className={styles.stepBody}>
                  <Heading as="h3" className={styles.stepTitle}>
                    {step.title}
                  </Heading>
                  <p className={styles.stepDescription}>{step.description}</p>
                  <Link className={styles.stepLink} to={step.to}>
                    {step.label} →
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.band} id="node-guides">
        <div className={clsx(styles.inner, styles.guidesInner)}>
          <SectionIntro title="Οδηγοί για κόμβους">
            Ξεκίνα από τον βασικό οδηγό και μετά διάλεξε τον κόμβο που σου
            ταιριάζει.
          </SectionIntro>
          <Link
            className={clsx(styles.card, styles.starter, styles.accentGreen)}
            to="/docs/get-started">
            <div className={styles.starterCopy}>
              <Heading as="h3" className={styles.starterTitle}>
                Πρώτη φορά στο Meshtastic; Ξεκίνα από εδώ
              </Heading>
              <p className={styles.cardDescription}>
                Τα βασικά για τον πρώτο σου κόμβο, χωρίς να χαθείς στις
                ρυθμίσεις.
              </p>
            </div>
            <span className={styles.starterCta}>Άνοιξε τον βασικό οδηγό →</span>
          </Link>
          <div className={styles.guideGrid}>
            {nodeGuides.map((guide) => (
              <Link
                className={clsx(styles.card, styles.guideCard, guide.accent)}
                key={guide.title}
                to={guide.to}>
                <Heading as="h3" className={styles.guideTitle}>
                  {guide.title}
                </Heading>
                <p className={styles.cardDescription}>{guide.description}</p>
                <span className={styles.guideCta}>Δες τον οδηγό →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.band}>
        <div className={styles.inner}>
          <SectionIntro title="Δες το δίκτυο από κοντά">
            Τρία εργαλεία, τρεις ματιές στο ίδιο δίκτυο.
          </SectionIntro>
          <ul className={styles.toolList}>
            {networkTools.map((tool) => (
              <li key={tool.title}>
                <Link className={styles.toolRow} to={tool.to}>
                  <span className={styles.toolTitle}>{tool.title}</span>
                  <span className={styles.toolDescription}>
                    {tool.description}
                  </span>
                  <span className={styles.toolCta}>{tool.label} →</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={clsx(styles.band, styles.hub, styles.community)}>
        <div className={clsx(styles.inner, styles.communityGrid)}>
          <div>
            <Heading as="h2" className={styles.communityTitle}>
              Το δίκτυο το φτιάχνουν άνθρωποι
            </Heading>
            <p className={styles.sectionDescription}>
              Έλα στο Telegram, γνώρισε άλλους χρήστες και ρώτησε ό,τι
              χρειάζεσαι. Αν δεις κάτι λάθος ή κάτι που λείπει στους οδηγούς,
              στείλε διόρθωση ή πρόταση.
            </p>
          </div>
          <ul className={styles.communityLinks}>
            {communityLinks.map((link) => (
              <li key={link.label}>
                <Link className={styles.communityLink} to={link.to}>
                  <svg {...iconProps}>{link.icon}</svg>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
