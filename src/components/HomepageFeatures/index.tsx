import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type ActionItem = {
  title: string;
  description: string;
  label: string;
  meta?: string;
  href?: string;
  to?: string;
};

type ToolItem = {
  title: string;
  summary: string;
  caution: string;
  href: string;
  label: string;
};

type GuideItem = {
  title: string;
  audience: string;
  description: string;
  points: string[];
  label: string;
  to: string;
};

const startLinks: ActionItem[] = [
  {
    title: 'Πρώτος κόμβος χωρίς άγχος',
    description:
      'Τα βασικά για να ξεκινήσεις σωστά: region EU_868, ρόλος CLIENT, hop limit και τα λίγα που αξίζει να πειράξεις στην αρχή.',
    label: 'Δες τον οδηγό εκκίνησης',
    to: '/docs/get-started',
  },
  {
    title: 'Τι συσκευή να πάρεις',
    description:
      'Αν δεν ξέρεις τι να αγοράσεις, ξεκίνα εδώ. Θα σου γλιτώσει αρκετό ψάξιμο και τα πιο κλασικά λάθη.',
    label: 'Δες το προτεινόμενο υλικό',
    to: '/docs/recommended-hardware',
    meta: 'Το βασικό: η συσκευή να είναι 868MHz.',
  },
  {
    title: 'Οι συχνές απορίες, μαζεμένες',
    description:
      'MQTT, hop limit, χάρτης και τα κλασικά μπερδέματα που έρχονται τις πρώτες μέρες.',
    label: 'Άνοιξε τις συχνές ερωτήσεις',
    to: '/docs/faq',
  },
];

const toolRows: ToolItem[] = [
  {
    title: 'Χάρτης Κόμβων Ελλάδας',
    summary:
      'Για μια πρώτη εικόνα αν υπάρχει γενικά παρουσία κοντά σου.',
    caution: 'Δεν αποδεικνύει ότι όλοι οι κόμβοι που βλέπεις είναι ενεργοί εκείνη τη στιγμή.',
    label: 'Άνοιξε τον χάρτη',
    href: 'https://map.m-powered.gr/',
  },
  {
    title: 'Meshview',
    summary:
      'Για γρήγορη εικόνα από ό,τι φτάνει στο MQTT: κόμβοι, χάρτης, telemetry και κίνηση.',
    caution: 'Είναι live εργαλείο, όχι πλήρης εικόνα όλης της LoRa κίνησης.',
    label: 'Άνοιξε το Meshview',
    href: 'https://meshview.m-powered.gr/',
  },
  {
    title: 'Malla',
    summary:
      'Για πιο βαθύ ψάξιμο πάνω στα ίδια MQTT δεδομένα: packet browser, traceroutes και network graph.',
    caution: 'Δεν είναι δεύτερη ανεξάρτητη πηγή από το Meshview. Διαβάζει πάλι MQTT.',
    label: 'Άνοιξε το Malla',
    href: 'https://malla.m-powered.gr/',
  },
];

const guideCards: GuideItem[] = [
  {
    title: 'Ξεκινώντας',
    audience: 'Για πρώτο κόμβο και πρώτο στήσιμο',
    description:
      'Ο σύντομος οδηγός για να μπεις στο δίκτυο σωστά από την πρώτη μέρα.',
    points: ['region EU_868 και CLIENT', 'hop limit 3 ή 4', 'τι να αφήσεις για αργότερα'],
    label: 'Ξεκίνα από εδώ',
    to: '/docs/get-started',
  },
  {
    title: 'Προσωπικός Κόμβος',
    audience: 'Για φορητή συσκευή, αυτοκίνητο ή σπίτι',
    description:
      'Για καθημερινή χρήση, όταν ο κόμβος είναι δικός σου και δεν τον στήνεις σαν υποδομή.',
    points: ['φορητή ή οικιακή χρήση', 'πρακτικές ρυθμίσεις', 'τι να κρατήσεις απλό'],
    label: 'Δες τον οδηγό για προσωπικό κόμβο',
    to: '/docs/personal-node',
  },
  {
    title: 'Σταθεροί Κόμβοι & Backbone',
    audience: 'Για σταθερό σημείο και σοβαρότερη κάλυψη',
    description:
      'Για περιπτώσεις όπου η θέση και η κεραία μπορούν όντως να βοηθήσουν το δίκτυο.',
    points: ['CLIENT_BASE και ROUTER_LATE', 'κεραία και θέση', 'favorites και zero-cost hops'],
    label: 'Δες τον οδηγό για σταθερούς κόμβους',
    to: '/docs/fixed-nodes-backbone',
  },
];

function ActionLink({title, description, label, meta, href, to}: ActionItem) {
  const linkProps = href
    ? {
        href,
        target: '_blank',
        rel: 'noopener noreferrer',
      }
    : {
        to: to ?? '/',
      };

  return (
    <Link className={styles.actionLink} {...linkProps}>
      <div className={styles.actionCopy}>
        <Heading as="h3" className={styles.actionTitle}>
          {title}
        </Heading>
        <p className={styles.actionDescription}>{description}</p>
        {meta ? <p className={styles.actionMeta}>{meta}</p> : null}
      </div>
      <span className={styles.actionCta}>{label}</span>
    </Link>
  );
}

function ToolRow({title, summary, caution, href, label}: ToolItem) {
  return (
    <div className={styles.toolRow}>
      <div className={styles.toolCopy}>
        <Heading as="h3" className={styles.toolTitle}>
          {title}
        </Heading>
        <p className={styles.toolSummary}>{summary}</p>
        <p className={styles.toolCaution}>{caution}</p>
      </div>
      <Link
        className={styles.toolLink}
        href={href}
        target="_blank"
        rel="noopener noreferrer">
        {label}
      </Link>
    </div>
  );
}

function GuideCard({title, audience, description, points, label, to}: GuideItem) {
  return (
    <Link className={styles.guideCard} to={to}>
      <p className={styles.guideAudience}>{audience}</p>
      <Heading as="h3" className={styles.guideTitle}>
        {title}
      </Heading>
      <p className={styles.guideDescription}>{description}</p>
      <ul className={styles.guideList}>
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <span className={styles.guideCta}>{label}</span>
    </Link>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.hub}>
      <div className="container">
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <Heading as="h2" className={styles.sectionTitle}>
                Ξεκίνα από τα λίγα που όντως χρειάζεσαι
              </Heading>
              <p className={styles.sectionDescription}>
                Αν τώρα μπαίνεις στο Meshtastic, αυτά φτάνουν για να μπεις
                σωστά στο δίκτυο χωρίς να πειράζεις ρυθμίσεις που δεν
                χρειάζονται ακόμα.
              </p>
            </div>
          </div>
          <div className={styles.stack}>
            {startLinks.map((link) => (
              <ActionLink key={link.title} {...link} />
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <Heading as="h2" className={styles.sectionTitle}>
                Ό,τι κι αν στήνεις, σε καλύπτουμε
              </Heading>
              <p className={styles.sectionDescription}>
                Διάλεξε τον οδηγό που ταιριάζει σε αυτό που στήνεις τώρα. Οι
                υπόλοιποι θα είναι εδώ όταν τους χρειαστείς.
              </p>
            </div>
          </div>
          <div className={styles.guideGrid}>
            {guideCards.map((card) => (
              <GuideCard key={card.title} {...card} />
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <Heading as="h2" className={styles.sectionTitle}>
                Τα εργαλεία που σε βοηθούν να δεις τι συμβαίνει
              </Heading>
              <p className={styles.sectionDescription}>
                Χάρτης, Meshview και Malla μπορούν να σε βοηθήσουν να
                ξεκαθαρίσεις τι φαίνεται πού. Και αν θέλεις βοήθεια μετά, θα
                σου είναι πιο εύκολο να εξηγήσεις τι βλέπεις.
              </p>
            </div>
          </div>
          <div className={styles.toolTable}>
            {toolRows.map((tool) => (
              <ToolRow key={tool.title} {...tool} />
            ))}
          </div>
          <Link className={styles.sectionLink} to="/docs/community-tools">
            Δες πότε βοηθά το κάθε εργαλείο
          </Link>
        </section>
      </div>
    </section>
  );
}
