import { Ref } from 'react';

declare namespace JSX {
  interface IntrinsicElements {
    'css-doodle': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
      ref?: Ref<HTMLElement>;
    }, HTMLElement> & {
      children?: string;
    };
  }
}

