import type {ReactNode} from 'react';
import {Redirect} from '@docusaurus/router';

export default function BasicConfigurationRedirect(): ReactNode {
  return <Redirect to="/docs/get-started" />;
}
