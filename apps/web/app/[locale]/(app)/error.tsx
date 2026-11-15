'use client';

import { useTranslations } from 'next-intl';
import { Button, ErrorState } from '@revn/ui';

export default function WorkspaceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('common');
  return (
    <ErrorState
      title={t('workspaceErrorTitle')}
      description={t('workspaceErrorDescription')}
      action={
        <Button type="button" onClick={reset}>
          {t('retryWorkspace')}
        </Button>
      }
    />
  );
}
