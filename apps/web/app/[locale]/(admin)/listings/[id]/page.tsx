import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/route-guard';
import { ListingEditorShell } from '@/components/listing/listing-editor-shell';
import { getListing } from '@/lib/api/listing-client';

export default async function AdminListingEditorPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  const guard = await requireAuth(params.locale);
  if (guard.status !== 'authenticated') {
    redirect(`/${params.locale}/login`);
  }

  let listing;
  try {
    listing = await getListing(guard.accessToken, params.id, guard.user.brandId);
  } catch {
    redirect(`/${params.locale}/listings`);
  }

  return (
    <ListingEditorShell
      listing={listing}
      locale={params.locale}
      accessToken={guard.accessToken}
      brandId={guard.user.brandId}
    />
  );
}
