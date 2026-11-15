'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff } from 'lucide-react';
import { Input, type InputProps } from '@revn/ui';

export function PasswordInput({ className, type: _type, ...props }: InputProps) {
  const t = useTranslations('common');
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`pe-12 ${className ?? ''}`}
      />
      <button
        type="button"
        aria-label={t(visible ? 'hidePassword' : 'showPassword')}
        aria-pressed={visible}
        aria-controls={props.id}
        onClick={() => setVisible((value) => !value)}
        className="text-muted-body hover:text-ink focus-visible:ring-accent absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
      >
        <Icon className="size-[18px]" aria-hidden="true" />
      </button>
    </div>
  );
}
