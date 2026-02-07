import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Η Ελλάδα έχει Mesh Δίκτυο',
  tagline: '(Και θέλουμε να πούμε, "Γεια!")',
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
        },
        blog: {
          showReadingTime: true,
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
      title: 'm-powered',
      logo: {
        alt: 'm-powered Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Οδηγός',
        },
        {to: '/blog', label: 'Blog', position: 'left'},
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
              to: '/docs/intro',
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
          ],
        },
        {
          title: 'Περισσότερα',
          items: [
            {
              label: 'Map',
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
      copyright: `Copyright © ${new Date().getFullYear()} m-powered.gr. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
