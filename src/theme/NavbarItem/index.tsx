import React from 'react';
import NavbarItem from '@theme-original/NavbarItem';
import type NavbarItemType from '@theme/NavbarItem';
import type {WrapperProps} from '@docusaurus/types';
import StatusWidget from '@site/src/components/StatusWidget';

type Props = WrapperProps<typeof NavbarItemType> & {
  readonly items?: readonly any[];
  readonly mobile?: boolean;
  readonly position?: 'left' | 'right';
  readonly label?: string;
  readonly href?: string;
};

export default function NavbarItemWrapper(props: Props) {
  const {mobile, position, href} = props;

  if (!mobile && position === 'right' && href?.includes('github.com')) {
    return (
      <>
        <StatusWidget />
        <NavbarItem {...props} />
      </>
    );
  }

  return <NavbarItem {...props} />;
}
