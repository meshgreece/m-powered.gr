import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Επικοινωνία Χωρίς Internet',
    Svg: require('@site/static/img/undraw_going-offline_v4oo.svg').default,
    description: (
      <>
        Στείλε μηνύματα χωρίς δίκτυο κινητής ή WiFi. Το Meshtastic χρησιμοποιεί 
        LoRa τεχνολογία για επικοινωνία σε απόσταση χιλιομέτρων.
      </>
    ),
  },
  {
    title: 'Αποκεντρωμένο Δίκτυο',
    Svg: require('@site/static/img/undraw_connection_ts3f.svg').default,
    description: (
      <>
        Κάθε συσκευή είναι κόμβος που επεκτείνει το mesh δίκτυο. Όσο περισσότεροι 
        κόμβοι, τόσο μεγαλύτερη η κάλυψη και η αξιοπιστία.
      </>
    ),
  },
  {
    title: 'Ανοιχτού Κώδικα',
    Svg: require('@site/static/img/undraw_open-source_g069.svg').default,
    description: (
      <>
        Πλήρως open source και με οικονομικό hardware. Ξεκίνα με €35 και γίνε 
        μέρος της ελληνικής mesh κοινότητας.
      </>
    ),
  },
];

function Feature({title, Svg, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
