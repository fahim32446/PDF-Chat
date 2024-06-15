import { db } from '@/db';
import { SendMessageValidator } from '@/lib/validator';
import { HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from '@langchain/google-genai';
import { PineconeStore } from '@langchain/pinecone';
import { Pinecone } from '@pinecone-database/pinecone';
import { NextRequest, NextResponse } from 'next/server';

export const POST = async (req: NextRequest) => {
  // Asking question based on pdf file

  const body = await req.json();

  const { getUser } = getKindeServerSession();
  const user = await getUser();

  const userId = user?.id;

  if (!userId) return new Response('Unauthorize', { status: 401 });

  const { fileId, message } = SendMessageValidator.parse(body);

  const pinecone = new Pinecone();
  const pineconeIndex = pinecone.Index('pdf-chat');

  // 1: vectorize message

  const embeddings = new GoogleGenerativeAIEmbeddings({
    model: 'embedding-001',
  });

  const file = await db.file.findFirst({
    where: {
      id: fileId,
      userId: userId,
    },
  });

  if (!file) return new Response('Not found', { status: 404 });

  await db.message.create({
    data: {
      text: message,
      isUserMessage: true,
      userId,
      fileId,
    },
  });

  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
    namespace: file?.id,
  } as { pineconeIndex: any });

  const results = await vectorStore.similaritySearch(message, 4);
  const relevantContext = results
    .map((result) => result.pageContent)
    .join('\n\n');

  const model = new ChatGoogleGenerativeAI({
    model: 'gemini-pro',
    maxOutputTokens: 2048,
    streaming: true,
    temperature: 0.5,
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
      },
    ],
  });

  // \n ADVICE: Arrange the answer to the question a little

  try {
    const res = await model.invoke(
      `RELEVANT CONTEXT:\n${relevantContext}\nUSER QUESTION: ${message}`
    );

    await db.message.create({
      data: {
        text: res.content as string,
        isUserMessage: false,
        fileId,
        userId,
      },
    });

    return NextResponse.json({
      success: true,
      status: 200,
      data: res.content,
    });
  } catch (error) {
    console.log(error);
  }

  if (!file) return new Response('File Not Found', { status: 404 });

  // if (!file) return new Response('File Not Found', { status: 404 });
};
