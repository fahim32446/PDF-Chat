import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import {
  Document,
  RecursiveCharacterTextSplitter,
} from '@pinecone-database/doc-splitter';
import { Pinecone } from '@pinecone-database/pinecone';
import md5 from 'md5';

import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import type { NextApiRequest, NextApiResponse } from 'next';
import { NextResponse } from 'next/server';

type ResponseData = {
  message: string;
};

export async function GET(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const pinecone = new Pinecone({
    apiKey: '33a00af7-61b2-4699-bf43-f67effd4bc35',
  });

  const pineconeIndex = pinecone.Index('pdf-chat');
  const embeddings = new GoogleGenerativeAIEmbeddings({
    model: 'embedding-001',
  });

  async function embedDocument(doc: Document) {
    try {
      const embeddings = await getEmbeddings(doc.pageContent);
      const hash = md5(doc.pageContent);
      const metadata: metaData = doc.metadata as any;

      return {
        id: hash,
        values: embeddings,
        metadata: {
          text: doc.metadata.text,
          pageNumber: doc.metadata.pageNumber,
        },
      };
    } catch (error) {
      console.log('error embedding document', error);
      throw error;
    }
  }

  async function getEmbeddings(text: string) {
    return await embeddings.embedQuery(text);
  }

  try {
    const response = await fetch(
      'https://utfs.io/f/6401e859-5955-47b2-a7ea-157405f51c04-nttamu.pdf'
    );
    const blob = await response.blob();
    const loader = new PDFLoader(blob);

    const pages = await loader.load();

    // 2. split and segment the pdf
    const documents = await Promise.all(pages?.map(prepareDocument));

    // 3. victories and embed individual documents
    const vectors = await Promise.all(documents.flat().map(embedDocument));
    //@ts-ignore
    const res = await pineconeIndex.namespace('ns5').upsert(vectors);

    return NextResponse.json({
      success: true,
      status: 200,
      message: 'Successfully vector inserted',
    });
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error });
  }
}

async function prepareDocument(page: Document) {
  let { pageContent, metadata } = page;

  const enc = new TextEncoder();
  pageContent = pageContent.replace(/\n/g, '');
  const splitter = new RecursiveCharacterTextSplitter();
  //     {
  //     chunkSize: 500,
  //     chunkOverlap: 50,
  //   }
  const docs = await splitter.splitDocuments([
    new Document({
      pageContent,
      metadata: {
        //@ts-ignore
        pageNumber: metadata.loc.pageNumber,
        text: new TextDecoder('utf-8').decode(
          enc.encode(pageContent).slice(0, 36000)
        ),
      },
    }),
  ]);
  return docs;
}

interface metaData {
  source: string;
  blobType: string;
  pdf: {
    version: string;
    info: {
      PDFFormatVersion: string;
      IsAcroFormPresent: boolean;
      IsXFAPresent: boolean;
      Title: string;
      Author: string;
      Keywords: string;
      Creator: string;
      Producer: string;
      CreationDate: string;
      ModDate: string;
    };
    metadata: string;
    totalPages: number;
  };
  loc: { pageNumber: number };
}
