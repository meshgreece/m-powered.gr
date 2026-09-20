import {translate} from '@docusaurus/Translate';
import type {FeedStatus} from '@site/src/lib/packetFeed';

export function getStatusLabel(status: FeedStatus): string {
  switch (status.kind) {
    case 'loading':
      return translate({
        id: 'statusWidget.loading',
        message: 'Φορτώνει η ζωντανή ροή…',
      });
    case 'error':
      return translate({
        id: 'statusWidget.error',
        message: 'Η ζωντανή ροή δεν είναι διαθέσιμη',
      });
    case 'live':
      return status.seconds === 0
        ? translate({
            id: 'statusWidget.liveNow',
            message: 'Τελευταίο πακέτο μόλις τώρα',
          })
        : translate(
            {
              id: 'statusWidget.liveSeconds',
              message: 'Τελευταίο πακέτο πριν από {seconds} δ.',
            },
            {seconds: status.seconds},
          );
    // The abbreviation carries no plural, so one minute and many read alike.
    case 'stale':
      return translate(
        {
          id: 'statusWidget.staleMinutes',
          message: 'Τελευταίο πακέτο πριν από {minutes} λ.',
        },
        {minutes: status.minutes},
      );
    case 'waiting':
      return translate({
        id: 'statusWidget.waiting',
        message: 'Περιμένουμε πακέτα',
      });
  }
}

export function getStatusAccessibleName(label: string): string {
  return translate(
    {
      id: 'statusWidget.accessibleName',
      message: 'Κατάσταση δικτύου: {status}',
    },
    {status: label},
  );
}
