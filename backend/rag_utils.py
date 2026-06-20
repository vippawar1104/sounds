import os
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_cohere import CohereEmbeddings
from langchain_community.vectorstores import Chroma

load_dotenv()

# Configuration
CHROMA_PATH = "chroma_db"
os.makedirs(CHROMA_PATH, exist_ok=True)

def get_embeddings():
    api_key = os.getenv("COHERE_API_KEY")
    if not api_key:
        return None
    return CohereEmbeddings(cohere_api_key=api_key, model="embed-english-v3.0")


def get_vector_db():
    emb = get_embeddings()
    if not emb:
        return None
    return Chroma(persist_directory=CHROMA_PATH, embedding_function=emb)

def process_document(file_path: str, agent_id: int):
    """Load, split, and index document for a specific agent."""
    vector_db = get_vector_db()
    if not vector_db:
        print("Error: COHERE_API_KEY not found. RAG indexing skipped.")
        return False

    if file_path.endswith(".pdf"):
        loader = PyPDFLoader(file_path)
    else:
        loader = TextLoader(file_path)
        
    docs = loader.load()
    
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    chunks = text_splitter.split_documents(docs)
    
    # Add metadata to filter by agent_id later
    for chunk in chunks:
        chunk.metadata["agent_id"] = agent_id
        
    vector_db.add_documents(chunks)
    return True

def query_knowledge_base(query: str, agent_id: int):
    """Search for relevant context from the agent's knowledge base."""
    vector_db = get_vector_db()
    if not vector_db:
        return "Knowledge base search unavailable (API key missing)."
        
    results = vector_db.similarity_search(
        query, 
        k=3, 
        filter={"agent_id": agent_id}
    )
    return "\n".join([doc.page_content for doc in results])
