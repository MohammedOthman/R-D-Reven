import { getTranslations } from 'next-intl/server';
import { TableSkeleton } from '@revn/ui';

export default async function WorkspaceLoading() {
  const t = await getTranslations('common');
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <p className="text-muted-body text-sm">{t('loadingWorkspace')}</p>
      <TableSkeleton columns={4} />
    </div>
  );
}
