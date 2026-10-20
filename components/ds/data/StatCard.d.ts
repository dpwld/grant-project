import React from 'react';

/**
 * Dashboard KPI widget: label, large value (with optional unit), trend delta
 * (up = green, down = red, flat = gray), an accent icon, and a context note.
 *
 * @startingPoint section="Data" subtitle="KPI / metric widget" viewport="900x640"
 */
export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Small trailing unit, e.g. "K/W", "%". */
  unit?: React.ReactNode;
  icon?: React.ReactNode;
  /** Delta label, e.g. "+12%". */
  delta?: React.ReactNode;
  deltaDirection?: 'up' | 'down' | 'flat';
  note?: React.ReactNode;
}
export function StatCard(props: StatCardProps): JSX.Element;
