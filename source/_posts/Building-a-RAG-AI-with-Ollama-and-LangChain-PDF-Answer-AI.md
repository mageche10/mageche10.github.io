---
title: Building a RAG AI with Ollama and LangChain - PDF Answer AI
date: 2025-08-20 14:05:06
tag: [Machine Learning]
categories: [projects]
featured_image: /images/RAG_and_LLM_architecture.png
---
Recently, I was working on a small procedural generator where I needed AI-generated descriptions. With no prior experience in the field, I decided to dive deep into [LLM (Large Language Models)](https://en.wikipedia.org/wiki/Large_language_model) and figure out how to run them locally. On top of that, I wanted the responses to be based on information I had stored inside a PDF. 

I found plenty of information on how to do it with python, but I really wanted to do this with [Node JS](https://nodejs.org/). Unfortunately, there wasn't much information for that... so I decided to document the journey myself. Join me in building a Retrieval-Augmented Generation (RAG) pipeline!

## Core idea

The goal is to use a language model on top of a custom PDF. That way, the AI can **understand, summarize, or analyze** your own documents, while keeping everything local and private. This technique is called [RAG (Retrieval-augmented generation)](https://en.wikipedia.org/wiki/Retrieval-augmented_generation): a technique that enables AI to incorporate external information in its database, in this case, from your PDF.

We will be using the following tools:
 - [Ollama](https://ollama.com/): for running the LLM.
 - [LangChain](https://www.langchain.com/): to simplify file processing the file.
 - [ChromaDB](https://www.trychroma.com/): for saving the PDF data once processed by AI.
 - Optional: [Docker](https://www.docker.com/): for running a ChromaDB server as a docker container.

### Prerequisites

Although it's not a very advanced topic, you will need the following knowledge:
 - How to start a node js project and use npm.
 - Basic knowledge regarding Large Language Models.
 - Familiarity with command line operations
 - Having either Docker or Python to use a ChromaDB Server. Check [this](https://cookbook.chromadb.dev/running/running-chroma/#local-server) to use Chroma locally.

### Architecture overview

Let's have a look at what we need to built:

![](/images/RAG_and_LLM_architecture.png)

1. Extract the data from the PDF and convert it into an AI-friendly language (with a specific Ollama model).
2. Store this data to retrieve it later.
3. Find relevant chunks of information for the user prompt in the stored data.
4. Pass both the question and the retrieved context to the LLM, which then generates an answer.

## Step-by-step guide

### Step 1: Install the dependencies

Let's start installing the required npm packages:

```bash
$ npm install ollama pdf-parse chromadb @langchain/community @langchain/core @langchain/ollama
```

Then we get the desired Ollama model. In my case I will use [Deepseek-r1:8b](https://ollama.com/library/deepseek-r1), but it's quite large and you will need a decent GPU. You can download any other [ollama model](https://ollama.com/search) you like (personally I recommend [mistral](https://ollama.com/library/mistral) to begin with). You will need also a model for processing the pdf, in this case, go with nomic embed text.

```bash
$ ollama pull deepseek-r1:8b
$ ollama pull nomic-embed-text:v1.5
```

We can start creating a .js file and importing the modules:

```javascript
import ollama from "ollama";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter }  from "langchain/text_splitter";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OllamaEmbeddings } from "@langchain/ollama";
```

> Note that you have to be running an ollama instance in order for the program to work. You can start one with *Ollama serve* in the CLI.

### Step 2: Process the PDF and store vectors

First, create a loader with the LangChain function PDFLoader and extract the text of the file. Then we split the text extracted into chunks to store the data.

```javascript
const loader = new PDFLoader("/path/to/PDF file", { splitPages: false })
const docs = await loader.load()

const text = docs[0].pageContent

const splitter = new RecursiveCharacterTextSplitter(
    { chunkSize: 1000, chunkOverlap: 200 });
const docOutput = await splitter.createDocuments([text]);
```

Splitting the text is crucial for the AI to find similarities. Later, you can customize these parameters: 
 - **ChunkSize**: How many tokens (characters) will be in every chunk.
 - **ChunkOvelap**: How many tokens will overlap with other chunks.

Then, we will translate the chunks into AI friendly language. Those are called vectors, and we will store them in ChromaDB.

First we initialize the Ollama model to create those vectors (or embeddings). Here I will use the [Nomic Embed model](https://ollama.com/library/nomic-embed-text:v1.5). Then I will use the model to process the text chunks and store them on a Chroma Database local server. If you don't know how to use Chorma click [here](https://cookbook.chromadb.dev/running/running-chroma/#local-server). In my case, I am using a docker container to run Chroma locally.

```javascript
const embeddings = new OllamaEmbeddings({
    model: "nomic-embed-text:v1.5"
})
const dbOptions = { collectionName: "pdf_name_collection", host: "localhost", port: 8000 }

const vectorstore = await Chroma.fromDocuments([], embeddings, dbOptions)

for (let i = 0; i < docs.length; i++) {
    await vectorstore.addDocuments([docs[i]])
    console.log(`Processing ${i + 1} of ${docs.length} chunks (${((i + 1) / docs.length * 100).toFixed(1)}%)`)
}
```

> Obviusly, you can use another form of storage to save those vectors. In fact, LangChain supports a lot of options.

### Step 3: Run the model

Now let’s put everything together and actually query the model. We start by searching for similarities between our question and the content of the document. Then we make a new prompt that will use our main LLM.

```javascript
const query = "Your query (Ex: What can you tell me about 'X' topic?)"

const TOP_K = 4
const similarities = await vectorstore.similaritySearch(query, TOP_K);
const context = similarities.map(similarity => similarity.pageContent).join("\n");

const prompt = `${query} \n\n To answer, use only this information ${context}.
 If you don't know the answer just say it, do not try to make up an answer.`;
```

Here we can see that we use the option *TOP_K*, this means how many chunks we will get when finding similarities. The larger this number, the more context AI gets, but also the slower it will be. You can also experiment with another prompt to see if it results in better responses.

Finally, we run the model with our new prompt.

```javascript
const response = await ollama.generate({
    model: "deepseek-r1:8b",
    prompt: prompt,
    stream: false
})
console.log(response.response)
```

Right now, the query is hard-code, so this isn't a standalone program. From here, it’s up to you how you want to integrate it with your app.

Check the whole code [**here**](/files/RAG_LLM.js)!

### Improvements

In this version, we are generating the vectors every time we want a response, but there is a better way to do it; we are using a database for something. We can check if the embeddings for this file are created by adding this before generating the new ones: 
```javascript
const existingVectors = await Chroma.fromExistingCollection(embeddings, dbOptions)
const i = await existingVectors.collection.count()

if (i > 0) {
    console.log("Loaded existing chroma vectors")
    vectorstore = existingVectors
} else {
    const vectorstore = await Chroma.fromDocuments([], embeddings, dbOptions)

    for (let i = 0; i < docs.length; i++) {
        await vectorstore.addDocuments([docs[i]])
        console.log(`Processing ${i + 1} of ${docs.length} chunks 
        (${((i + 1) / docs.length * 100).toFixed(1)}%)`)
    }
}
```

## Conclusions

This setup is a simple but powerful way to give your AI access to your own documents while keeping everything private and local. Moreover, after some testing, I can say that the results are pretty solid, even with the smaller version models.

You now have the building blocks for a RAG pipeline with Node.js, Ollama, LangChain, and ChromaDB. From here, you can expand it into a full app — maybe a chatbot, a document assistant, or even part of a larger system.
