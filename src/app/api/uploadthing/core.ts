import { db } from '@/db';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { PineconeStore } from '@langchain/pinecone';
import {
  Document,
  RecursiveCharacterTextSplitter,
} from '@pinecone-database/doc-splitter';
import { Pinecone } from '@pinecone-database/pinecone';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';

import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';

import { createUploadthing, type FileRouter } from 'uploadthing/next';

const f = createUploadthing();

const auth = (req: Request) => ({ id: 'fakeId' });

export const ourFileRouter = {
  pdfUploader: f({ pdf: { maxFileSize: '4MB' } })
    .middleware(async ({ req }) => {
      const { getUser } = getKindeServerSession();
      const user = await getUser();

      if (!user || !user.id) throw new Error('Unauthorized');
      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const createdFile = await db.file.create({
        data: {
          key: file.key,
          name: file.name,
          userId: metadata.userId,
          url: file.url,
          uploadStatus: 'PROCESSING',
        },
      });

      try {
        const response = await fetch(file.url);
        const blob = await response.blob();
        const loader = new PDFLoader(blob);

        const pageLevelDocs = await loader.load();
        const pagesAmt = pageLevelDocs.length;

        // vectorize and index entire document

        const pinecone = new Pinecone();
        const pineconeIndex = pinecone.Index('pdf-chat');

        const embeddings = new GoogleGenerativeAIEmbeddings({
          model: 'embedding-001', // 768 dimensions
        });

        console.log({ embeddings, pageLevelDocs });

        // const res = await embeddings.embedQuery('OK Google');

        // console.log(res, res.length);

        try {
          const res = await PineconeStore.fromDocuments(
            pageLevelDocs,
            embeddings,
            {
              pineconeIndex,
              maxConcurrency: 5,
              namespace: file.key,
            }
          );
          console.log({ res });
        } catch (error) {
          console.log(error);
        }

        // const pinecone = await getPineconeClient();
        // const pineconeIndex = pinecone.Index('pdf-chat');

        // const embeddings = new OpenAIEmbeddings({
        //   openAIApiKey:
        //     'sk-proj-evCNThgoYf5KjHtpN2D0T3BlbkFJ3FsGfXC47Yq73U2y7UC4',
        // });

        try {
          // const res = await PineconeStore.fromDocuments(
          //   pageLevelDocs,
          //   embeddings,
          //   {
          //     pineconeIndex,
          //     namespace: createdFile.id,
          //   }
          // );
          // console.log(res);
        } catch (error) {
          console.log(error);
        }

        await db.file.update({
          data: {
            uploadStatus: 'SUCCESS',
          },
          where: {
            id: createdFile.id,
          },
        });
      } catch (error) {
        await db.file.update({
          data: {
            uploadStatus: 'FAILED',
          },
          where: {
            id: createdFile.id,
          },
        });
      }
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;

async function prepareDocument(page) {
  let { pageContent, metadata } = page;
  console.log('_____________HEY________________');

  const enc = new TextEncoder();
  pageContent = pageContent.replace(/\n/g, '');
  // split the docs
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
  });
  const docs = await splitter.splitDocuments([
    new Document({
      pageContent,
      metadata: {
        pageNumber: metadata.loc.pageNumber,
        text: new TextDecoder('utf-8').decode(
          enc.encode(pageContent).slice(0, 36000)
        ),
      },
    }),
  ]);
  return docs;
}
