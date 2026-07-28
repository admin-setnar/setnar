'use client';

import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { Input, type InputProps } from '@/shared/ui/input';

/**
 * PasswordInput
 *
 * Purpose: password entry with a reveal toggle — measurably reduces typos and
 * abandoned sign-ups on mobile keyboards.
 * Accessibility: the toggle is a real button with a state-dependent accessible
 * name, and is reachable by keyboard.
 */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type' | 'trailing'>>(
  function PasswordInput(props, ref) {
    const [visible, setVisible] = useState(false);
    const Icon = visible ? EyeOff : Eye;

    return (
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        trailing={
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={visible}
            className="rounded-sm p-1 text-content-subtle transition-colors duration-fast hover:text-content"
          >
            <Icon size={16} aria-hidden="true" />
          </button>
        }
        {...props}
      />
    );
  },
);
