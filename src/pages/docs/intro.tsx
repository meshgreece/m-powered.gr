import type {ReactNode} from 'react';
import {Redirect} from '@docusaurus/router';

export default function IntroRedirect(): ReactNode {
  return <Redirect to="/docs/get-started" />;
}
