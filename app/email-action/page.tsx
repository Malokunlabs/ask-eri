import EmailAction from '../../components/EmailAction';
export const metadata = { title: 'Confirm your email choices | ERI', referrer: 'no-referrer', robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const value = (key: string) => typeof query[key] === 'string' ? String(query[key]).slice(0, 200) : '';
  return <EmailAction purpose={value('purpose')} id={value('id')} token={value('token')} />;
}
