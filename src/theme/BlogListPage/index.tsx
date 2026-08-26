import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {
  BlogPostProvider,
  useBlogPost,
} from '@docusaurus/plugin-content-blog/client';
import {
  HtmlClassNameProvider,
  PageMetadata,
  ThemeClassNames,
} from '@docusaurus/theme-common';
import BlogListPaginator from '@theme/BlogListPaginator';
import BlogListPageStructuredData from '@theme/BlogListPage/StructuredData';
import Layout from '@theme/Layout';
import MDXContent from '@theme/MDXContent';
import SearchMetadata from '@theme/SearchMetadata';
import type {Props} from '@theme/BlogListPage';

import styles from './styles.module.css';

function BlogListPageMetadata({metadata}: Props): ReactNode {
  const {
    siteConfig: {title: siteTitle},
  } = useDocusaurusContext();
  const {blogDescription, blogTitle, permalink} = metadata;
  const title = permalink === '/' ? siteTitle : blogTitle;

  return (
    <>
      <PageMetadata title={title} description={blogDescription} />
      <SearchMetadata tag="blog_posts_list" />
    </>
  );
}

function ChangelogEntry({children}: {children: ReactNode}): ReactNode {
  const {metadata} = useBlogPost();
  const {date, permalink, tags, title} = metadata;
  const formattedDate = new Intl.DateTimeFormat('el-GR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(date));

  return (
    <article className={styles.entry}>
      <time className={styles.date} dateTime={date}>
        {formattedDate}
      </time>
      <div className={styles.entryBody}>
        <h2 className={styles.entryTitle}>
          <Link to={permalink}>{title}</Link>
        </h2>
        {tags.length > 0 && (
          <div aria-label="Ετικέτες" className={styles.tags}>
            {tags.map((tag) => (
              <Link
                className={styles.tag}
                key={tag.permalink}
                to={tag.permalink}>
                {tag.label}
              </Link>
            ))}
          </div>
        )}
        <div className={clsx('markdown', styles.summary)}>
          <MDXContent>{children}</MDXContent>
        </div>
        <Link className={styles.moreLink} to={permalink}>
          Άνοιγμα ενημέρωσης
        </Link>
      </div>
    </article>
  );
}

function BlogListPageContent({items, metadata}: Props): ReactNode {
  return (
    <Layout>
      <div className="container">
        <main className={styles.page}>
          <header className={styles.header}>
            <div>
              <h1>Ενημερώσεις</h1>
              <p>
                Σύντομες σημειώσεις για όσα αλλάζουν στους οδηγούς, τα εργαλεία
                και την εικόνα του ελληνικού mesh.
              </p>
            </div>
            <nav
              aria-label="Αρχείο και ροή ενημερώσεων"
              className={styles.links}>
              <Link to="/blog/archive">Αρχείο</Link>
              <a href="/blog/rss.xml">RSS</a>
            </nav>
          </header>

          <div className={styles.entries}>
            {items.map(({content: BlogPostContent}) => (
              <BlogPostProvider
                content={BlogPostContent}
                key={BlogPostContent.metadata.permalink}>
                <ChangelogEntry>
                  <BlogPostContent />
                </ChangelogEntry>
              </BlogPostProvider>
            ))}
          </div>

          <BlogListPaginator metadata={metadata} />
        </main>
      </div>
    </Layout>
  );
}

export default function BlogListPage(props: Props): ReactNode {
  return (
    <HtmlClassNameProvider
      className={clsx(
        ThemeClassNames.wrapper.blogPages,
        ThemeClassNames.page.blogListPage,
      )}>
      <BlogListPageMetadata {...props} />
      <BlogListPageStructuredData {...props} />
      <BlogListPageContent {...props} />
    </HtmlClassNameProvider>
  );
}
