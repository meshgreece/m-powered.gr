import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  // Automatically generated sidebar from docs folder with proper ordering
  tutorialSidebar: [
    {
      type: 'category',
      label: 'Ξεκίνα',
      collapsed: false,
      items: [
        {
          type: 'doc',
          id: 'get-started',
          label: 'Ξεκινώντας',
        },
        {
          type: 'doc',
          id: 'network-settings',
          label: 'Ρυθμίσεις δικτύου',
        },
        {
          type: 'doc',
          id: 'recommended-hardware',
          label: 'Προτεινόμενο υλικό',
        },
        {
          type: 'doc',
          id: 'configuration-generator',
          label: 'Προφίλ ρυθμίσεων',
        },
      ],
    },
    {
      type: 'category',
      label: 'Κόμβοι',
      collapsed: false,
      items: [
        {
          type: 'doc',
          id: 'personal-node',
          label: 'Προσωπικός κόμβος',
        },
        {
          type: 'doc',
          id: 'fixed-nodes',
          label: 'Σταθεροί κόμβοι',
        },
        {
          type: 'doc',
          id: 'best-practices',
          label: 'Καλές πρακτικές',
        },
      ],
    },
    {
      type: 'category',
      label: 'Monitoring και βοήθεια',
      collapsed: false,
      items: [
        {
          type: 'doc',
          id: 'community-tools',
          label: 'Εργαλεία κοινότητας',
        },
        {
          type: 'doc',
          id: 'mqtt',
          label: 'MQTT και uplinks',
        },
        {
          type: 'doc',
          id: 'coverage-map',
          label: 'Κατανομή preset',
        },
        {
          type: 'doc',
          id: 'faq',
          label: 'Συχνές ερωτήσεις',
        },
        {
          type: 'link',
          label: 'Κατάσταση backbone κόμβων της κοινότητας',
          href: '/status',
        },
      ],
    },
  ],
};

export default sidebars;
