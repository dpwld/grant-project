import React from 'react';

/** On/off toggle for settings and feature flags. Controlled or uncontrolled; sizes sm/md. */
export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  size?: 'sm' | 'md';
  children?: React.ReactNode;
}
export function Switch(props: SwitchProps): JSX.Element;
