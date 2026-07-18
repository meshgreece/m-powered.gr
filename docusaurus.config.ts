import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Meshtastic Greece Community',
  tagline:
    'Οδηγοί, χάρτης κόμβων και τα βασικά για να μπεις στο ελληνικό mesh χωρίς πολύ ψάξιμο.',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://m-powered.gr',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'meshgreece', // Usually your GitHub org/user name.
  projectName: 'm-powered.gr', // Usually your repo name.
  trailingSlash: false,

  onBrokenLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
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
          editUrl:
            'https://github.com/meshgreece/m-powered.gr/tree/master/',
        },
        blog: {
          blogTitle: 'Νέα του Meshtastic Greece Community',
          blogDescription:
            'Νέα, οδηγοί και ενημερώσεις για την κοινότητα Meshtastic στην Ελλάδα.',
          showReadingTime: true,
          editUrl:
            'https://github.com/meshgreece/m-powered.gr/tree/master/',
          feedOptions: {
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
    image: 'img/m-powered-social-card.png',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Meshtastic Greece Community',
      logo: {
        alt: 'Meshtastic Greece Community m-powered logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Οδηγοί',
        },
        {to: '/blog', label: 'Νέα', position: 'left'},
        {to: '/status', label: 'Κατάσταση', position: 'left'},
        {
          label: 'Εργαλεία',
          position: 'left',
          items: [
            {
              label: 'Προφίλ Ρυθμίσεων',
              to: '/docs/configuration-generator',
            },
            {
              label: 'Χάρτης Κόμβων',
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
              label: 'Ξεκινώντας',
              to: '/docs/get-started',
            },
            {
              label: 'Προτεινόμενο Υλικό',
              to: '/docs/recommended-hardware',
            },
            {
              label: 'Προσωπικός Κόμβος',
              to: '/docs/personal-node',
            },
            {
              label: 'Σταθεροί Κόμβοι & Backbone',
              to: '/docs/fixed-nodes-backbone',
            },
            {
              label: 'Συχνές Ερωτήσεις',
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
              label: 'Εργαλεία Κοινότητας',
              to: '/docs/community-tools',
            },
          ],
        },
        {
          title: 'Εργαλεία',
          items: [
            {
              label: 'Χάρτης Κόμβων Ελλάδας',
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
      copyright: `Το m-powered.gr είναι ανεξάρτητος ιστότοπος κοινότητας και δεν ανήκει στο Meshtastic project.<br />Copyright © ${new Date().getFullYear()} m-powered.gr. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
