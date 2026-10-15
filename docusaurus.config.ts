import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Meshtastic Greece Community',
  tagline:
    'Από το firmware μέχρι το πρώτο «γεια», όλα τα βήματα για να μπεις στο δίκτυο της κοινότητάς μας.',
  favicon: 'img/favicon.ico',

  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
    faster: true, // Use the Rspack/SWC build path @docusaurus/faster ships
  },

  url: 'https://m-powered.gr',
  baseUrl: '/',

  organizationName: 'meshgreece',
  projectName: 'm-powered.gr',
  trailingSlash: false,

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'el',
    locales: ['el'],
  },
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/meshgreece/m-powered.gr/tree/master/',
        },
        blog: {
          blogTitle: 'Ενημερώσεις',
          blogDescription:
            'Σύντομες ενημερώσεις του Meshtastic Greece Community για τους οδηγούς, τα εργαλεία και το δίκτυο της κοινότητας.',
          blogSidebarCount: 0,
          postsPerPage: 'ALL',
          showReadingTime: false,
          editUrl: 'https://github.com/meshgreece/m-powered.gr/tree/master/',
          feedOptions: {
            title: 'Ενημερώσεις | Meshtastic Greece Community',
            description:
              'Σύντομες ενημερώσεις του Meshtastic Greece Community για τους οδηγούς, τα εργαλεία και το δίκτυο της κοινότητας.',
            type: ['rss', 'atom'],
            xslt: true,
          },
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/m-powered-social-card-2026.png',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Meshtastic Greece Community',
      logo: {
        alt: 'Λογότυπο του Meshtastic Greece Community στο m-powered.gr',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Οδηγοί',
        },
        {to: '/blog', label: 'Ενημερώσεις', position: 'left'},
        {to: '/status', label: 'Κατάσταση', position: 'left'},
        {
          label: 'Εργαλεία',
          position: 'left',
          items: [
            {
              label: 'Προφίλ ρυθμίσεων',
              to: '/docs/configuration-generator',
            },
            {
              label: 'Χάρτης κόμβων',
              href: 'https://map.m-powered.gr/',
            },
            {
              label: 'Meshview',
              href: 'https://meshview.m-powered.gr/',
            },
            {
              label: 'Malla',
              href: 'https://malla.m-powered.gr/',
            },
          ],
        },
        {
          href: 'https://meshtastic.org/',
          label: 'Meshtastic Project',
          position: 'left',
        },
        {
          href: 'https://github.com/meshgreece/m-powered.gr',
          label: 'GitHub',
          position: 'right',
          className: 'navbar-github-link',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Οδηγοί',
          items: [
            {
              label: 'Ξεκίνα εδώ',
              to: '/docs/get-started',
            },
            {
              label: 'Ρυθμίσεις δικτύου',
              to: '/docs/network-settings',
            },
            {
              label: 'Προτεινόμενο υλικό',
              to: '/docs/recommended-hardware',
            },
            {
              label: 'Προσωπικός κόμβος',
              to: '/docs/personal-node',
            },
            {
              label: 'Σταθεροί κόμβοι',
              to: '/docs/fixed-nodes',
            },
            {
              label: 'Συχνές ερωτήσεις',
              to: '/docs/faq',
            },
          ],
        },
        {
          title: 'Κοινότητα',
          items: [
            {
              label: 'Telegram',
              href: 'https://t.me/+_5Z0q7DWM6UwMDJk',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/meshgreece/m-powered.gr',
            },
            {
              label: 'Εργαλεία κοινότητας',
              to: '/docs/community-tools',
            },
            {
              label: 'Πολιτική απορρήτου',
              to: '/privacy',
            },
          ],
        },
        {
          title: 'Εργαλεία',
          items: [
            {
              label: 'Χάρτης κόμβων στο m-powered.gr',
              href: 'https://map.m-powered.gr/',
            },
            {
              label: 'Meshview',
              href: 'https://meshview.m-powered.gr/',
            },
            {
              label: 'Malla',
              href: 'https://malla.m-powered.gr/',
            },
          ],
        },
      ],
      copyright: `Το m-powered.gr είναι ανεξάρτητος ιστότοπος κοινότητας. Δεν ανήκει στο έργο Meshtastic και δεν έχει επίσημη έγκριση ή χορηγία από αυτό.<br />© ${new Date().getFullYear()} m-powered.gr. Δημιουργήθηκε με Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
