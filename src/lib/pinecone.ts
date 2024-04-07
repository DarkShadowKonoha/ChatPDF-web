import {Pinecone, PineconeRecord} from '@pinecone-database/pinecone';
import { downloadFromS3 } from './s3-server';
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import {Document, RecursiveCharacterTextSplitter} from '@pinecone-database/doc-splitter';
import { getEmbeddings } from './embeddings';
import md5 from 'md5';
import { convertToAscii } from './utils';

export const getPineconeClient = () => {
    return new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
  };

type PDFPage = {
    pageContent: string;
    metadata: {
        loc: {pageNumber: number};
    };
};

export async function loadS3IntoPinecone(fileKey:string) {
    // 1. obtain the pdf
    console.log('downloading s3 into file system')
    const file_name = await downloadFromS3(fileKey);
    if (!file_name){
        throw new Error("could not download from s3");
    }
    const loader = new PDFLoader(file_name);
    const pages = (await loader.load()) as PDFPage[];

    console.log('Pages->>', pages);
    // 2. Split and segment the pdf 
    const documents = await Promise.all(pages.map(prepareDocument));
    console.log('Splitted Document->>', documents);

    // 3. vectorise and embed individual documents
    const vectors = await Promise.all(documents.flat().map(embedDocument));

    // 4. upload to pinecone
    const client = await getPineconeClient();
    const pineconeIndex = client.Index('chatpdf-web')

    console.log('inserting vectors into pinecone')
    const namespace = pineconeIndex.namespace(convertToAscii(fileKey));

    console.log("inserting vectors into pinecone");
    await namespace.upsert(vectors);

    return documents[0];
}

async function embedDocument(doc: Document) {
    try {
        const embeddings = await getEmbeddings(doc.pageContent)
        const hash = md5(doc.pageContent)

        return {
            id: hash,
            values: embeddings,
            metadata: {
                text: doc.metadata.text,
                pageNumber: doc.metadata.pageNumber
            }
        } as PineconeRecord;
    } catch (error) {
        console.log('error embedding document', error)
        throw error
    }
}

export const truncateStringByBytes = (str: string, bytes: number) => {
    const enc = new TextEncoder();
    return new TextDecoder("utf-8").decode(enc.encode(str).slice(0, bytes));
  };

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 3000,
    chunkOverlap: 200,
})

async function prepareDocument(page: PDFPage) {
    let {pageContent, metadata} = page;
    pageContent = pageContent.replace(/\n/g, '');
    // split docs
    // const splitter = new RecursiveCharacterTextSplitter();
    const docs = await splitter.splitDocuments([
        new Document({
            pageContent,
            metadata: {
                pageNumber: metadata.loc.pageNumber,
                text: truncateStringByBytes(pageContent, 36000),
            }
        })
    ])
    return docs;
}