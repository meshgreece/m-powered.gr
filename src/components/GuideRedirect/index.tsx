import type {ReactNode} from 'react';
import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import {Redirect} from '@docusaurus/router';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Layout from '@theme/Layout';

type GuideRedirectProps = {
  to: string;
  title: string;
};

export default function GuideRedirect({
  to,
  title,
}: GuideRedirectProps): ReactNode {
  const targetPath = useBaseUrl(to);
  const targetUrl = useBaseUrl(to, {absolute: true});

  return (
    <Layout title="Η σελίδα μεταφέρθηκε">
      <Head>
        <meta httpEquiv="refresh" content={`0;url=${targetPath}`} />
        <link rel="canonical" href={targetUrl} />
        <meta property="og:url" content={targetUrl} />
      </Head>
      <Redirect to={targetPath} />
      <main className="container margin-vert--xl">
        <h1>Η σελίδα μεταφέρθηκε</h1>
        <p>
          Συνέχισε στη σελίδα <Link to={targetPath}>{title}</Link>.
        </p>
      </main>
    </Layout>
  );
}
