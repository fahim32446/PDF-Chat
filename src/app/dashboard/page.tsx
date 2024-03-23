import { redirect } from 'next/navigation';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import React from 'react';

type Props = {};

const page = async (props: Props) => {
  const { getUser } = getKindeServerSession();
  const user = await getUser();


  if (!user || !user.id) redirect('/auth-callback?origin=dashboard');
  return (<div>
    
    
  </div>);
};

export default page;
