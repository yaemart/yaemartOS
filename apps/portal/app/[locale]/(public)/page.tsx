import { redirect } from 'next/navigation';

interface Props {
  params: { locale: string };
}

export default function HomePage({ params: { locale } }: Props) {
  redirect(`/${locale}/products`);
}
