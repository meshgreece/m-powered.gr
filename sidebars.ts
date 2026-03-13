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
      type: 'doc',
      id: 'get-started',
      label: 'Ξεκινώντας',
    },
    {
      type: 'doc',
      id: 'basic-configuration',
      label: 'Βασική Διαμόρφωση',
    },
    {
      type: 'doc',
      id: 'advanced-configuration',
      label: 'Προχωρημένη Διαμόρφωση',
    },
  ],
};

export default sidebars;
