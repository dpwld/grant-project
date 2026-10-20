'use client';
import React from 'react';

/* 기업 Switch — on/off toggle for settings and feature flags. */

const CSS = `
.sx-switch { display: inline-flex; align-items: center; gap: 9px; cursor: pointer; font-family: var(--font-sans); font-size: var(--text-md); color: var(--text-default); user-select: none; position: relative; }
.sx-switch--disabled { cursor: not-allowed; opacity: 0.5; }
.sx-switch__track {
  width: 36px; height: 20px; flex-shrink: 0;
  background: var(--gray-300);
  border-radius: var(--radius-pill);
  position: relative;
  transition: background var(--dur-base) var(--ease-out);
}
.sx-switch__track::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 16px; height: 16px; border-radius: 50%;
  background: #fff; box-shadow: var(--shadow-xs);
  transition: transform var(--dur-base) var(--ease-out);
}
.sx-switch--sm .sx-switch__track { width: 30px; height: 17px; }
.sx-switch--sm .sx-switch__track::after { width: 13px; height: 13px; }
.sx-switch__native { position: absolute; opacity: 0; width: 0; height: 0; }
.sx-switch__native:focus-visible + .sx-switch__track { box-shadow: var(--ring-focus); }
.sx-switch--on .sx-switch__track { background: var(--color-primary); }
.sx-switch--on .sx-switch__track::after { transform: translateX(16px); }
.sx-switch--on.sx-switch--sm .sx-switch__track::after { transform: translateX(13px); }
`;

let _injected = false;
function inject() {
  if (_injected || typeof document === 'undefined') return;
  _injected = true;
  const s = document.createElement('style');
  s.setAttribute('data-sx', 'switch');
  s.textContent = CSS;
  document.head.appendChild(s);
}

export function Switch({ checked, defaultChecked, disabled = false, size = 'md', onChange, className = '', children, ...rest }) {
  inject();
  const isControlled = checked !== undefined;
  const [internal, setInternal] = React.useState(defaultChecked || false);
  const on = isControlled ? checked : internal;
  const cls = [
    'sx-switch',
    on ? 'sx-switch--on' : '',
    size === 'sm' ? 'sx-switch--sm' : '',
    disabled ? 'sx-switch--disabled' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <label className={cls}>
      <input
        type="checkbox" role="switch"
        className="sx-switch__native"
        checked={isControlled ? checked : undefined}
        defaultChecked={isControlled ? undefined : defaultChecked}
        disabled={disabled}
        onChange={(e) => { if (!isControlled) setInternal(e.target.checked); onChange && onChange(e); }}
        {...rest}
      />
      <span className="sx-switch__track" aria-hidden="true" />
      {children && <span>{children}</span>}
    </label>
  );
}
