import ollama from 'ollama';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter }  from "langchain/text_splitter";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OllamaEmbeddings } from "@langchain/ollama";

const loader = new PDFLoader("./path/to/document.pdf", { splitPages: false })
const docs = await loader.load()

const text = docs[0].pageContent

const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
const docOutput = await splitter.createDocuments([text]);

const embeddings = new OllamaEmbeddings({
    model: "nomic-embed-text:v1.5"
})
const dbOptions = { collectionName: "my_collection", host: "localhost", port: 8000 }

const vectorstore = await Chroma.fromDocuments([], embeddings, dbOptions)

for (let i = 0; i < docOutput.length; i++) {
    await vectorstore.addDocuments([docOutput[i]])
    console.log(`Processing ${i + 1} of ${docOutput.length} chunks (${((i + 1) / docOutput.length * 100).toFixed(1)}%)`)
}

const query = "Your query (Ex: What can you tell me about 'X' topic?)"

const TOP_K = 4
const similarities = await vectorstore.similaritySearch(query, TOP_K);
const context = similarities.map(similarity => similarity.pageContent).join("\n");

const prompt = `${query} \n\n To answer, use only this information ${context}.
 If you don't know the answer just say it, do not try to make up an answer.`;

const response = await ollama.generate({
    model: "deepseek-r1:8b",
    prompt: prompt,
    stream: false
})
console.log(response.response)