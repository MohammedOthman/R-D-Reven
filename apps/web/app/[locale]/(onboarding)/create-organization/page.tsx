import { setRequestLocale } from 'next-intl/server';
import { CreateOrganizationForm } from './CreateOrganizationForm';

export default async function CreateOrganizationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <CreateOrganizationForm />;
}
