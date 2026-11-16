'use client';

import { Icon, type IconProps } from '@iconify/react';
import arrowDown from '@iconify-icons/solar/arrow-down-linear';
import arrowRight from '@iconify-icons/solar/arrow-right-linear';
import arrowUpRight from '@iconify-icons/solar/arrow-right-up-linear';
import check from '@iconify-icons/solar/check-read-linear';
import circleCheck from '@iconify-icons/solar/check-circle-linear';
import fileCheck from '@iconify-icons/solar/document-add-linear';
import flag from '@iconify-icons/solar/flag-linear';
import layers from '@iconify-icons/solar/layers-linear';
import menu from '@iconify-icons/solar/hamburger-menu-linear';
import pause from '@iconify-icons/solar/pause-linear';
import play from '@iconify-icons/solar/play-linear';
import close from '@iconify-icons/solar/close-circle-linear';

// Solar via Iconify, CC BY 4.0. Attribution: docs/design/MOTION_GRAPHICS.md.
const icons = {
  arrowDown,
  arrowRight,
  arrowUpRight,
  check,
  circleCheck,
  fileCheck,
  flag,
  layers,
  menu,
  pause,
  play,
  close,
};
function makeIcon(name: keyof typeof icons) {
  return function HomeIcon({ size = 18, ...props }: Omit<IconProps, 'icon'> & { size?: number }) {
    return <Icon {...props} icon={icons[name]} width={size} height={size} ssr />;
  };
}
export const ArrowDown = makeIcon('arrowDown');
export const ArrowRight = makeIcon('arrowRight');
export const ArrowUpRight = makeIcon('arrowUpRight');
export const Check = makeIcon('check');
export const CircleCheck = makeIcon('circleCheck');
export const FileCheck2 = makeIcon('fileCheck');
export const Flag = makeIcon('flag');
export const Layers3 = makeIcon('layers');
export const Menu = makeIcon('menu');
export const Pause = makeIcon('pause');
export const Play = makeIcon('play');
export const X = makeIcon('close');
