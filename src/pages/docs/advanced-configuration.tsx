import type {ReactNode} from 'react';
import {Redirect} from '@docusaurus/router';

export default function AdvancedConfigurationRedirect(): ReactNode {
  return <Redirect to="/docs/get-started" />;
}
