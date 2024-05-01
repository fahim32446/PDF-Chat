import { db } from '@/db';
import { SendMessageValidator } from '@/lib/validator';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { NextRequest } from 'next/server';

export const POST = async (req: NextRequest) => {
  // Asking question based on pdf file

  const body = await req.json();

  const { getUser } = getKindeServerSession();
  const user = await getUser();

  const userId = user?.id;

  if (!userId) return new Response('Unauthorize', { status: 401 });

  const { fileId, message } = SendMessageValidator.parse(body);

  const file = await db.file.findFirst({
    where: {
      id: fileId,
      userId: userId,
    },
  });

  if (!file) return new Response('File Not Found', { status: 404 });

  await db.message.create({
    data: {
      text: message,
      isUserMessage: true,
      userId,
      fileId
    },
  });
};
