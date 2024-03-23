'use client';
import { useRouter, useSearchParams } from 'next/navigation';

type Props = {};

const Page = (props: Props) => {
  const router = useRouter();
  const searchParams = useSearchParams()
  const origin = searchParams.get('origin')
  
  return <div>Page</div>;
};

export default Page;
