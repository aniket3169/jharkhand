import ChallengeDetail from '@/components/challenges/challenge-detail';

export const metadata = { title: 'Challenge · Jharkhand Innovation' };
export default async function ChallengePage({ params }) { const { id } = await params; return <ChallengeDetail id={id} />; }
