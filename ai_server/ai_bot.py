# Replace with actual imports
import os
import hashlib
from uuid import uuid4
from langchain_openai import ChatOpenAI
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains import create_retrieval_chain
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain.chains import create_history_aware_retriever
from langchain_core.prompts import PromptTemplate
from langchain.callbacks import AsyncIteratorCallbackHandler
from qdrant_client import QdrantClient
from langchain_qdrant import QdrantVectorStore
from qdrant_client.models import Distance, VectorParams, PointIdsList,PointStruct,Filter, FieldCondition, MatchValue
from dotenv import load_dotenv
import logging
import sys
from langchain_community.document_loaders import PyPDFDirectoryLoader
from langchain.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever
import pickle
sys.stdout.reconfigure(encoding='utf-8')

# ตั้งค่า logging
log_dir = "/app/data/logs"
os.makedirs(log_dir, exist_ok=True)
logger = logging.getLogger("AI")
file_handler = logging.FileHandler(os.path.join(log_dir, 'AI.log'), encoding="utf-8")
console_handler = logging.StreamHandler(sys.stdout)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)
logger.addHandler(console_handler)
logger.setLevel(logging.INFO)

# โหลดไฟล์ .env
load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")


class BaseAIChat:
    def embeddings(self, docs):
        raise NotImplementedError("ฟังก์ชัน embeddings ต้องถูก override")

    def retrieval(self, vectordb, nftext=''):
        raise NotImplementedError("ฟังก์ชัน retrieval ต้องถูก override")

    def delete_embedding(self, dept_id, ids_to_delete):
        raise NotImplementedError("ฟังก์ชัน delete_embedding ต้องถูก override")


class RAG(BaseAIChat):
    def __init__(self):
        self.qdrant_client = QdrantClient(url="http://qdrant:6333")
        self.embedding = None
        self.bm25_docs = []  # Store documents for BM25
        self.bm25_storage_dir = "./bm25_data"
        os.makedirs(self.bm25_storage_dir, exist_ok=True)

    def _get_bm25_path(self, dept_id: str="",knowledge_base_id: str=""):
        return os.path.join(self.bm25_storage_dir, f"bm25_docs_{knowledge_base_id}.pkl")

    def _save_bm25_docs(self, dept_id: str="",knowledge_base_id: str=""):
        """Save BM25 documents to local storage"""
        try:
            bm25_path = self._get_bm25_path(dept_id,knowledge_base_id)
            with open(bm25_path, 'wb') as f:
                pickle.dump(self.bm25_docs, f)
            logger.info(f"BM25 documents saved to {bm25_path} ")
            return True
        except Exception as e:
            logger.error(f"Error saving BM25 documents: {str(e)}")
            return False

    def _load_bm25_docs(self, dept_id: str="",knowledge_base_id: str=""):
        """Load BM25 documents from local storage"""
        try:
            bm25_path = self._get_bm25_path(dept_id,knowledge_base_id)
            if os.path.exists(bm25_path):
                with open(bm25_path, 'rb') as f:
                    self.bm25_docs = pickle.load(f)
                logger.info(f"BM25 documents loaded from {bm25_path}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error loading BM25 documents: {str(e)}")
            return False

    def embeddings(self, docs=None, dept_id: str="",knowledge_base_id: str=""):
        try:
            logger.info("Loading or creating vectorstore for dept_id: %s", [dept_id ,knowledge_base_id])

            model_name = "sentence-transformers/all-MiniLM-L6-v2"
            model_kwargs = {'device': 'cpu'}
            self.embedding = HuggingFaceEmbeddings(model_name=model_name, model_kwargs=model_kwargs)

            collection_name = f"qdrant_dept_{knowledge_base_id}"

            if collection_name in [col.name for col in self.qdrant_client.get_collections().collections]:
                vectorstore = QdrantVectorStore(client=self.qdrant_client, collection_name=collection_name, embedding=self.embedding)
                logger.info("Existing vectorstore found for dept_id: %s", dept_id,knowledge_base_id)
                self._load_bm25_docs(dept_id,knowledge_base_id)
                return vectorstore

            if docs is None:
                logger.warning("No documents provided and no existing vectorstore found for dept_id: %s", [dept_id,knowledge_base_id])
                return "notfound"

            # Enhanced semantic text splitting
            text_splitter = RecursiveCharacterTextSplitter(
                separators=["\n\n", "\n", "。", "，", " ", "", "；", "：", "！", "？", "、", ".", ",", ";", ":", "!", "?"],
                chunk_size=300,  # Reduced chunk size for more precise retrieval
                chunk_overlap=100,  # Increased overlap to maintain context
                length_function=len,
                keep_separator=True,
                strip_whitespace=True,
                add_start_index=True
            )
            documents = text_splitter.split_documents(docs)

            # Add chunk metadata
            for i, doc in enumerate(documents):
                doc.metadata.update({
                    "chunk_id": i,
                    "total_chunks": len(documents),
                    "source": doc.metadata.get("source", "unknown"),
                    "chunk_type": "semantic_split"
                })

            # Store documents for BM25
            self.bm25_docs = documents.copy()
            self._save_bm25_docs(dept_id,knowledge_base_id)

            # Create vector store
            if self.qdrant_client.collection_exists(collection_name):
                self.qdrant_client.delete_collection(collection_name)

            self.qdrant_client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(size=len(self.embedding.embed_query("test")), distance=Distance.COSINE)
            )

            uuids = [str(uuid4()) for _ in range(len(documents))]
            vectorstore = QdrantVectorStore(client=self.qdrant_client, collection_name=collection_name, embedding=self.embedding)
            vectorstore.add_documents(documents=documents, ids=uuids)

            logger.info("New vectorstore and BM25 index created for dept_id: %s with %d chunks", [dept_id,knowledge_base_id], len(documents))
            return vectorstore
        except Exception as e:
            logger.error("Error in embeddings for dept_id: %s - %s", [dept_id,knowledge_base_id], str(e))
            return "notfound"

    def get_embedding(self, dept_id: str="",knowledge_base_id: str=""):
        """
        Get the embeddings for a specific department
        
        Args:
            dept_id: The department ID
            
        Returns:
            vectorstore: The vector store if found, "notfound" otherwise
        """
        try:
            logger.info("Getting vectorstore for dept_id: %s", [dept_id,knowledge_base_id])
            
            model_name = "sentence-transformers/all-MiniLM-L6-v2"
            model_kwargs = {'device': 'cpu'}
            self.embedding = HuggingFaceEmbeddings(model_name=model_name, model_kwargs=model_kwargs)
            
            collection_name = f"qdrant_dept_{knowledge_base_id}"
            
            if collection_name in [col.name for col in self.qdrant_client.get_collections().collections]:
                vectorstore = QdrantVectorStore(
                    client=self.qdrant_client, 
                    collection_name=collection_name, 
                    embedding=self.embedding
                )
                logger.info("Existing vectorstore found for dept_id: %s", [dept_id,knowledge_base_id])
                self._load_bm25_docs(dept_id,knowledge_base_id)
                return vectorstore
            
            logger.warning("No vectorstore found for dept_id: %s", [dept_id,knowledge_base_id])
            return "notfound"
            
        except Exception as e:
            logger.error("Error getting embeddings for dept_id: %s - %s", [dept_id,knowledge_base_id], str(e))
            return "notfound"

    def check_embedding(self, dept_id: str="", knowledge_base_id: str="") -> bool:
        """
        Check if embeddings exist for a specific department and knowledge base ID
        
        Args:
            dept_id: The department ID
            knowledge_base_id: The knowledge base ID
            
        Returns:
            bool: True if embeddings exist, False otherwise
        """
        try:
            collection_name = f"qdrant_dept_{knowledge_base_id}"
            exists = collection_name in [col.name for col in self.qdrant_client.get_collections().collections]
            
            if exists:
                # Check if collection has any points
                count = self.qdrant_client.count(collection_name=collection_name, exact=True).count
                return count > 0
                
            return False
            
        except Exception as e:
            logger.error("Error checking embeddings for dept_id: %s, knowledge_base_id: %s - %s", 
                        dept_id, knowledge_base_id, str(e))
            return False

    def retrieval(self,model_name:str= "gpt-4o-mini",dept_id:list|str = "",knowledge_base_id:list|str="", vectordb=None,prompt:str="", nftext:str='',temperature:float=0.5,max_tokens:int=1024):
        try:
            logger.info("Starting retrieval process")
            # Load BM25 docs if not already loaded
            if not self.bm25_docs:
                self._load_bm25_docs(dept_id[0] if isinstance(dept_id, list) else dept_id,
                                   knowledge_base_id[0] if isinstance(knowledge_base_id, list) else knowledge_base_id)

            if "gpt" in model_name:
                llm = ChatOpenAI(model=model_name, api_key=api_key, streaming=True, callbacks=[AsyncIteratorCallbackHandler()], max_tokens=max_tokens,temperature=temperature)
            
            # Handle multiple collections
            dept_ids = dept_id if isinstance(dept_id, list) else [dept_id]
            kb_ids = knowledge_base_id if isinstance(knowledge_base_id, list) else [knowledge_base_id]
            
            # If multiple collections needed
            if len(dept_ids) > 0 or len(kb_ids) > 0:
                from MultiQdrant import MultiCollectionQdrant
                model_name = "sentence-transformers/all-MiniLM-L6-v2"
                model_kwargs = {'device': 'cpu'}
                self.embedding = HuggingFaceEmbeddings(model_name=model_name, model_kwargs=model_kwargs)
                
                collection_names = []
                # Generate all collection names combinations
                for k_id in kb_ids:
                    collection_name = f"qdrant_dept_{k_id}"
                    if collection_name in [col.name for col in self.qdrant_client.get_collections().collections]:
                        collection_names.append(collection_name)
                
                if not collection_names:
                    logger.warning("No valid collections found")
                    return "notfound"
                
                # Create MultiQdrant instance
                multi_qdrant = MultiCollectionQdrant(
                    client=self.qdrant_client,
                    collection_names=collection_names,
                    embedding_model=self.embedding
                )
                
                # Create ensemble retriever with MultiQdrant
                qdrant_retriever = multi_qdrant.as_retriever(search_kwargs={
                    "k": 4,
                    "score_threshold": 0.3,
                })
                
                if self.bm25_docs:
                    bm25_retriever = BM25Retriever.from_documents(
                        self.bm25_docs,
                        preprocess_func=lambda x: x.lower(),
                    )
                    bm25_retriever.k = 4
                    ensemble_retriever = EnsembleRetriever(
                        retrievers=[qdrant_retriever, bm25_retriever],
                        weights=[0.6, 0.4]
                    )
                else:
                    logger.warning("No BM25 documents found, using only vector search")
                    ensemble_retriever = qdrant_retriever
            else:
                # Single collection handling (existing code)
                if vectordb is None:
                    model_name = "sentence-transformers/all-MiniLM-L6-v2"
                    model_kwargs = {'device': 'cpu'}
                    self.embedding = HuggingFaceEmbeddings(model_name=model_name, model_kwargs=model_kwargs)

                    qdrant_db = QdrantVectorStore(
                        client=self.qdrant_client,
                        collection_name=f"qdrant_dept_{knowledge_base_id}",
                        embedding=self.embedding
                    )

                    # Increased k and adjusted score threshold for better recall
                    qdrant_retriever = qdrant_db.as_retriever(search_kwargs={
                        "k": 4,  # Retrieve more candidates
                        "score_threshold": 0.3,  # Lower threshold to catch more potential matches
                    })

                    # Create BM25 retriever with adjusted parameters
                    if self.bm25_docs:
                        bm25_retriever = BM25Retriever.from_documents(
                            self.bm25_docs,
                            preprocess_func=lambda x: x.lower(),  # Case-insensitive matching
                        )
                        bm25_retriever.k = 4  # Match vector retriever k

                        # Create ensemble retriever with reweighted combination
                        ensemble_retriever = EnsembleRetriever(
                            retrievers=[qdrant_retriever, bm25_retriever],
                            weights=[0.6, 0.4]  # Slightly favor semantic search but keep strong keyword presence
                        )
                    else:
                        logger.warning("No BM25 documents found, using only vector search")
                        ensemble_retriever = qdrant_retriever
                else:
                    qdrant_db = vectordb
                    qdrant_retriever = qdrant_db.as_retriever(search_kwargs={
                        "k": 4,
                        "score_threshold": 0.3,
                    })
                    if self.bm25_docs:
                        bm25_retriever = BM25Retriever.from_documents(
                            self.bm25_docs,
                            preprocess_func=lambda x: x.lower()
                        )
                        bm25_retriever.k = 4
                        ensemble_retriever = EnsembleRetriever(
                            retrievers=[qdrant_retriever, bm25_retriever],
                            weights=[0.6, 0.4]
                        )
                    else:
                        print("No BM25 documents found, using only vector search")
                        ensemble_retriever = qdrant_retriever

            # Enhanced context-aware prompt
            contextualize_q_prompt = ChatPromptTemplate.from_messages([
                ("system", """Given a chat history and the latest user question, formulate a standalone question that:
                1. Captures the full context from chat history
                2. Maintains the original language of the question
                3. Includes any relevant keywords or specific terms
                4. Preserves the intent and scope of the original question
                Do NOT answer the question, just reformulate it if needed or return as is."""),
                MessagesPlaceholder("chat_history"),
                ("human", "{input}"),
            ])

            history_aware_retriever = create_history_aware_retriever(llm, ensemble_retriever, contextualize_q_prompt)

            prompt_template = (
                "Base Prompt:"
                "You are an AI assistant, providing concise and clear responses based on available information. You do not disclose data details."
                "Always respond in the same language as the user."
                "Please answer completely first. If you can't find the information but there is a link, please give the link."
                "If greeted (e.g., 'Hello,' 'Good morning'), respond politely."
                "If the question is partially related, provide the most relevant response using available context."
                "When providing links, ensure they open in a new tab using <a href='[URL]' target='_blank'>link text</a>."             
                "If the question is completely irrelevant to the given context or Back context: No information, please reply with 'Sorry, the system cannot provide an answer' or '" + nftext + "' (or translate this into the user's language)"
                "\n\n"
                "Specific Prompt:\n"
                ""+prompt+""
                """context: {context}"""
            )

            qa_prompt = ChatPromptTemplate.from_messages([
                ('system', prompt_template),
                MessagesPlaceholder('chat_history'),
                ('human', '{input}'),
            ])

            document_prompt = PromptTemplate(
                input_variables=["page_content", "source"],
                template="Source: {source}\n\nContent: {page_content}",
                validate_template=False
            )

            document_variable_name = "context"

            question_answer_chain = create_stuff_documents_chain(llm=llm, prompt=qa_prompt, document_prompt=document_prompt, document_variable_name=document_variable_name)
            retrieval_chain = create_retrieval_chain(history_aware_retriever, question_answer_chain)

            logger.info("Retrieval process completed with enhanced ensemble retriever")
            return retrieval_chain
        except Exception as e:
            logger.error("Error in retrieval process - %s", str(e))
            return "notfound"


    def delete_embedding(self, dept_id: str="",knowledge_base_id: str="", source_path: str="", dry_run: bool = True):
        """
        ลบเอกสารใน Qdrant collection ตามค่า source ใน metadata

        Args:
            qdrant_url (str): URL ของ Qdrant Server (เช่น "http://localhost:6333")
            dept_id (str): หมายเลขหรือรหัสของ department (จะสร้าง collection name อัตโนมัติ)
            source_path (str): ค่าที่ต้องการ match กับ metadata.source (เช่น "pdf\\1234.pdf")
            dry_run (bool): ถ้า True จะแค่พิมพ์รายการที่จะลบ (ไม่ลบจริง)
        """
        collection_name = f"qdrant_dept_{knowledge_base_id}"

        # นับจำนวนเริ่มต้น
        initial_count = self.qdrant_client.count(collection_name=collection_name, exact=True).count
        print(f"📊 Initial records in {collection_name}: {initial_count}")

        # Scroll หา document ที่ตรงกับ source
        results, _ = self.qdrant_client.scroll(
            collection_name=collection_name,
            scroll_filter=Filter(
                must=[
                    FieldCondition(
                        key="metadata.source",
                        match=MatchValue(value=source_path)
                    )
                ]
            ),
            with_payload=True,
            limit=1000000,  # ดึงทั้งหมด
        )

        if not results:
            print(f"❌ No documents found with source: {source_path}")
            return "notfound"

        ids_to_delete = [pt.id for pt in results]

        # แสดงข้อมูล
        for pt in results:
            print(f"🧾 ID: {pt.id}")
            print(f"📂 Source: {pt.payload['metadata'].get('source')}")

        print(f"🗑 Total documents matched: {len(ids_to_delete)}")
        
        # ลบจริงถ้าไม่ใช่ dry run
        if not dry_run:
            self.qdrant_client.delete(
                collection_name=collection_name,
                points_selector=PointIdsList(points=ids_to_delete)
            )
            print(f"✅ Deleted {len(ids_to_delete)} documents from {collection_name}")
            return 'success'
       


        # นับอีกครั้งหลังจากลบ
        final_count = self.qdrant_client.count(collection_name=collection_name, exact=True).count
        print(f"📊 Remaining records in {collection_name}: {final_count}")
        return 'success' if not dry_run else 'dry_run'


    def append_embeddings(self, docs, dept_id: str="", knowledge_base_id: str=""):
        try:
            logger.info("Appending new embeddings for dept_id: %s", [dept_id,knowledge_base_id])

            model_name = "sentence-transformers/all-MiniLM-L6-v2"
            model_kwargs = {'device': 'cpu'}
            self.embedding = HuggingFaceEmbeddings(model_name=model_name, model_kwargs=model_kwargs)

            collection_name = f"qdrant_dept_{knowledge_base_id}"

            if collection_name not in [col.name for col in self.qdrant_client.get_collections().collections]:
                logger.warning("Collection does not exist: %s", collection_name)
                return "notfound"

            # Enhanced semantic text splitting (same as embeddings method)
            text_splitter = RecursiveCharacterTextSplitter(
                separators=["\n\n", "\n", "。", "，", " ", "", "；", "：", "！", "？", "、", ".", ",", ";", ":", "!", "?"],
                chunk_size=300,  # Reduced chunk size for more precise retrieval
                chunk_overlap=100,  # Increased overlap to maintain context
                length_function=len,
                keep_separator=True,
                strip_whitespace=True,
                add_start_index=True
            )
            documents = text_splitter.split_documents(docs)

            # Add chunk metadata
            for i, doc in enumerate(documents):
                doc.metadata.update({
                    "chunk_id": i,
                    "total_chunks": len(documents),
                    "source": doc.metadata.get("source", "unknown"),
                    "chunk_type": "semantic_split"
                })

            # Add new documents to BM25 docs
            self.bm25_docs.extend(documents)
            self._save_bm25_docs(dept_id,knowledge_base_id)

            # Add to vector store
            uuids = [str(uuid4()) for _ in range(len(documents))]
            vectorstore = QdrantVectorStore(client=self.qdrant_client, collection_name=collection_name, embedding=self.embedding)
            vectorstore.add_documents(documents=documents, ids=uuids)

            logger.info("Appended %d new semantic chunks to collection %s", len(uuids), collection_name)
            return "success"
        except Exception as e:
            logger.error("Error appending embeddings for dept_id: %s - %s", [dept_id,knowledge_base_id], str(e))
            return "error"


    def update_embedding(self, dept_id: str="",knowledge_base_id: str="", new_documents=None):
        try:
            logger = logging.getLogger("update_embedding_batch")
            model_name = "sentence-transformers/all-MiniLM-L6-v2"
            model_kwargs = {'device': 'cpu'}
            embedding = HuggingFaceEmbeddings(model_name=model_name, model_kwargs=model_kwargs)

            collection_name = f"qdrant_dept_{knowledge_base_id}"

            if collection_name not in [col.name for col in self.qdrant_client.get_collections().collections]:
                logger.warning("Collection not found: %s", collection_name)
                return "notfound"

            if not new_documents:
                logger.error("No documents provided for update")
                return "notfound"

            source_path = new_documents[0].metadata.get("source")
            if not source_path:
                logger.error("Source not found in new_document.metadata")
                return "notfound"

            # Scroll through existing documents
            results, _ = self.qdrant_client.scroll(
                collection_name=collection_name,
                scroll_filter=Filter(
                    must=[
                        FieldCondition(
                            key="metadata.source",
                            match=MatchValue(value=source_path)
                        )
                    ]
                ),
                with_payload=True,
                limit=100000
            )

            if not results:
                logger.warning(f"No documents found with source: {source_path}")
                return "notfound"

            logger.info(f"Found {len(results)} documents for source: {source_path}")

            # Update BM25 docs - remove old documents with the same source
            self.bm25_docs = [doc for doc in self.bm25_docs if doc.metadata.get("source") != source_path]
            # Add new documents to BM25
            self.bm25_docs.extend(new_documents)
            self._save_bm25_docs(dept_id,knowledge_base_id)

            # Create mapping of page numbers to old points
            old_points_by_page = {}
            for point in results:
                page_num = point.payload.get("metadata", {}).get("page")
                if page_num is not None:
                    old_points_by_page[int(page_num)] = point

            points_to_upsert = []

            for doc in new_documents:
                page_num = doc.metadata.get("page")
                if page_num is None:
                    logger.warning("Document missing page number, skipping")
                    continue

                old_point = old_points_by_page.get(int(page_num))
                if not old_point:
                    logger.warning(f"No matching old document for page {page_num}, skipping")
                    continue

                old_text = old_point.payload.get("text", "")
                if old_text.strip() == doc.page_content.strip():
                    logger.info(f"Page {page_num}: Content unchanged, skipping update")
                    continue

                # Create new vector
                new_vector = embedding.embed_query(doc.page_content)

                # Merge metadata
                old_metadata = old_point.payload.get("metadata", {})
                updated_metadata = old_metadata.copy()
                updated_metadata.update(doc.metadata)

                # Create new point
                points_to_upsert.append(
                    PointStruct(
                        id=old_point.id,
                        vector=new_vector,
                        payload={
                            "metadata": updated_metadata,
                            "text": doc.page_content
                        }
                    )
                )

            if points_to_upsert:
                self.qdrant_client.upsert(
                    collection_name=collection_name,
                    points=points_to_upsert
                )
                logger.info(f"Successfully upserted {len(points_to_upsert)} documents")
                return "success"
            else:
                logger.warning("No points to upsert after processing")
                return "notfound"

        except Exception as e:
            logger.error(f"Error updating batch documents in dept_id {dept_id} and {knowledge_base_id}: {str(e)}")
            return "notfound"





    def query_documents_by_source(self, dept_id: str="",knowledge_base_id: str="", source_path: str=""):
        """
        ค้นหาเอกสารทั้งหมดที่มี metadata.source = source_path

        Args:
            dept_id (str): หมายเลข department เช่น 1
            source_path (str): path ของไฟล์ เช่น "pdf\\1234.pdf"

        Returns:
            list of dict: รายการข้อมูลที่พบ [{"id": ..., "page": ..., "text": ..., "metadata": {...}}, ...]
        """
        try:
            logger = logging.getLogger("query_documents_by_source")

            collection_name = f"qdrant_dept_{knowledge_base_id}"

            if collection_name not in [col.name for col in self.qdrant_client.get_collections().collections]:
                logger.warning(f"Collection {collection_name} not found")
                return []

            # 🔥 ค้นหา document ที่มี source_path ตรง
            results, _ = self.qdrant_client.scroll(
                collection_name=collection_name,
                scroll_filter=Filter(
                    must=[
                        FieldCondition(
                            key="metadata.source",
                            match=MatchValue(value=source_path)
                        )
                    ]
                ),
                with_payload=True,
                limit=100000
            )

            documents = []

            for point in results:
                payload = point.payload.get("metadata", {})
                documents.append({
                    "id": point.id,
                    "page": payload.get("page"),
                    "text": point.payload.get("page_content", ""),
                    "metadata": payload
                })

            logger.info(f"Found {len(documents)} documents for source {source_path}")
            return documents

        except Exception as e:
            logger.error(f"Error querying documents for source {source_path}: {str(e)}")
            return []


    def delete_collection(self, dept_id: str="",knowledge_base_id: str=""):
        # Delete the collection and BM25 data
        collection_name = "qdrant_dept_" + str(dept_id) + "_" + str(knowledge_base_id)
        bm25_path = self._get_bm25_path(dept_id,knowledge_base_id)
        success = True

        # 1. Check if collection exists
        if self.qdrant_client.collection_exists(collection_name):
            # 2. Delete if exists
            logger.info("Deleting collection: %s", collection_name)
            self.qdrant_client.delete_collection(collection_name=collection_name)
            logger.info("Collection deleted successfully")
        
        # Delete BM25 data if exists
        if os.path.exists(bm25_path):
            try:
                os.remove(bm25_path)
                logger.info(f"BM25 data deleted: {bm25_path}")
                self.bm25_docs = []  # Clear the in-memory BM25 docs
            except Exception as e:
                logger.error(f"Error deleting BM25 data: {str(e)}")
                success = False

        return "success" if success else "error"
    

    







if __name__ == "__main__":
    rag_model = RAG()
    dept_id = "1"
    knowledge_base_id = "tcu"
    pdf_directory_path = "pdf"
    pdf_loader = PyPDFDirectoryLoader(pdf_directory_path)
    docs = pdf_loader.load()
    print(docs)
    print(f"Loaded {len(docs)} documents")

    # # #delete collection
    # rag_model.delete_collection(dept_id=dept_id,knowledge_base_id=knowledge_base_id)


    # # # show
    # # show_docs = rag_model.query_documents_by_source(
    # # dept_id=1,
    # # source_path="pdf\\1234.pdf"
    # # )
    # # print(show_docs)


    # Create embeddings for the loaded documents
    embeddings = rag_model.embeddings(docs=docs, dept_id=dept_id,knowledge_base_id=knowledge_base_id)
    if embeddings != "notfound":
        logger.info("Embeddings created successfully")
    else:
        logger.error("Failed to create embeddings")




    # # Append new embeddings to the existing collection
    # pdf2_loader = PyPDFDirectoryLoader("pdf2")
    # docs2 = pdf2_loader.load()
    # res2 = rag_model.append_embeddings(docs=docs2, dept_id=dept_id,knowledge_base_id=knowledge_base_id)
    # if res2 == "success":
    #     logger.info("Embeddings appended successfully")
    # else:
    #     logger.error("Failed to append embeddings")





    # Create a retrieval chain

    input_text = "當然委員有誰?"
    input_text2 = "King Rama IV and his passion?"


    retrieval_chain = rag_model.retrieval(model_name="gpt-4o-mini",dept_id= 1,knowledge_base_id=knowledge_base_id,nftext="Sorry, the system cannot provide an answer.")
    if retrieval_chain != "notfound":
        full_answer = ""
        logger.info("Retrieval chain created successfully")
        response = retrieval_chain.invoke({"input": input_text, "chat_history": []})
        response2 = retrieval_chain.invoke({"input": input_text2, "chat_history": []})

        print(f"Full answer: {response}")
        print(f"Full answer: {response2}")
    else:
        logger.error("Failed to create retrieval chain")


    

    # #UPDATE EMBEDDING
    # update_embedding_result = rag_model.update_embedding(dept_id=dept_id,knowledge_base_id=knowledge_base_id, new_documents=docs)
    # if update_embedding_result == "success":
    #     logger.info("Embeddings updated successfully")
    # elif update_embedding_result == "notfound":
    #     logger.info("No documents found to update")
    # else:
    #     logger.error("Failed to update embeddings")





    # # Create embeddings for the loaded documents
    # show_docs = rag_model.query_documents_by_source(
    # dept_id=1,
    # source_path="pdf\\1234.pdf"
    # )
    # print(show_docs)


    # # Delete an embedding
    # delete_embedding_result = rag_model.delete_embedding(dept_id=dept_id,knowledge_base_id=knowledge_base_id, source_path="pdf2\\123.pdf", dry_run=False)
    # if delete_embedding_result == "success":
    #     logger.info("Embeddings deleted successfully")
    # elif delete_embedding_result == "dry_run":
    #     logger.info("Dry run completed, no documents were deleted")
    # else:
    #     logger.error("Failed to delete embeddings")


    # response = retrieval_chain.invoke({"input": input_text, "chat_history": []})
    # response2 = retrieval_chain.invoke({"input": input_text2, "chat_history": []})

    # print(f"Full answer: {response}")
    # print(f"Full answer: {response2}")


