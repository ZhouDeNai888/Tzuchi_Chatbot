from langchain.vectorstores.base import VectorStore
from langchain.schema import Document
from typing import List
from qdrant_client import QdrantClient
from langchain.vectorstores import Qdrant
from langchain.embeddings import OpenAIEmbeddings
from langchain.chains import RetrievalQA
from langchain.llms import OpenAI
from qdrant_client.models import Distance, VectorParams
from langchain.schema import Document
import sys
sys.stdout.reconfigure(encoding='utf-8')
class MultiCollectionQdrant(VectorStore):
    def __init__(self, client: QdrantClient, collection_names: List[str], embedding_model):
        self.client = client
        self.collection_names = collection_names
        self.embedding_model = embedding_model
        self.vectorstores = [
            Qdrant(client=client, collection_name=name, embeddings=embedding_model)
            for name in collection_names
        ]

    def similarity_search(self, query: str, k: int = 4, **kwargs) -> List[Document]:
        all_results = []
        for vs in self.vectorstores:
            results = vs.similarity_search(query, k=k, **kwargs)
            all_results.extend(results)
        return all_results

    def similarity_search_with_score(self, query: str, k: int = 4, **kwargs) -> List[tuple[Document, float]]:
        all_results = []
        for vs in self.vectorstores:
            results = vs.similarity_search_with_score(query, k=k, **kwargs)
            all_results.extend(results)

        # เรียงจากคะแนนมาก -> น้อย
        all_results.sort(key=lambda x: x[1], reverse=True)
        return all_results

    def add_documents(self, documents: List[Document], collection_name: str = None, **kwargs) -> List[str]:
        """
        เพิ่ม documents ลงใน collection เดียว หรือทุก collection ก็ได้

        Args:
            documents: List ของ Document ที่จะเพิ่ม
            collection_name: ถ้าใส่ จะเพิ่มเฉพาะ collection นี้, ถ้าไม่ใส่ จะเพิ่มให้ทุก collection
            kwargs: อื่น ๆ ที่จะส่งไปให้ vectorstore.add_documents()

        Returns:
            List ของ IDs ของ document ที่เพิ่มสำเร็จ
        """
        if collection_name:
            # เพิ่มลงเฉพาะ collection ที่เลือก
            vs_list = [vs for vs in self.vectorstores if vs.collection_name == collection_name]
            if not vs_list:
                raise ValueError(f"Collection '{collection_name}' not found in MultiCollectionQdrant.")
        else:
            # ถ้าไม่กำหนด collection_name → เพิ่มทุก collection
            vs_list = self.vectorstores

        all_ids = []
        for vs in vs_list:
            ids = vs.add_documents(documents, **kwargs)
            all_ids.extend(ids)

        return all_ids
    

    @classmethod
    def from_texts(cls, texts: List[str], embedding_model, client: QdrantClient, collection_names: List[str], **kwargs):
        """
        สร้าง MultiCollectionQdrant จาก list ของข้อความ
        จะเพิ่มข้อความเข้า collection แรกใน collection_names
        """
        # สร้าง instance ก่อน
        instance = cls(client=client, collection_names=collection_names, embedding_model=embedding_model)

        # เอา text ไปสร้าง Document
        documents = [Document(page_content=text) for text in texts]

        # เพิ่มเข้า collection แรก (หรือวนเพิ่มได้ถ้าอยากทำ advanced)
        if collection_names:
            instance.add_documents(documents, collection_name=collection_names[0])

        return instance

if __name__ == "__main__":
    api_key = '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'


    docs = [
        Document(page_content="แมวชอบนอน", metadata={"source": "บทความ1"}),
        Document(page_content="หมาชอบวิ่ง", metadata={"source": "บทความ2"})
    ]


    docs2 = [
        Document(page_content="ฉันชอบกินก๋วยเตื๋ยว", metadata={"source": "บทความ3"}),
        Document(page_content="my name is john", metadata={"source": "บทความ4"})
    ]

    


    # 1. เชื่อม Qdrant
    client = QdrantClient(url="http://localhost:6333")
    embedding_model = OpenAIEmbeddings(api_key=api_key)


    collections = ["collection1", "collection2"]


    
    for collection_name in collections:
        if collection_name in [col.name for col in client.get_collections().collections]:
            continue  # ถ้ามี collection นี้อยู่แล้ว ไม่ต้องสร้างใหม่
        else:
            client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(size=len(embedding_model.embed_query("test")), distance=Distance.COSINE)
            )

    # 2. สร้าง Multi-Collection Vectorstore
    multi_vectorstore = MultiCollectionQdrant(
        client=client,
        collection_names=collections,
        embedding_model=embedding_model
    )

    multi_vectorstore.add_documents(docs, collection_name="collection1")
    multi_vectorstore.add_documents(docs2, collection_name="collection2")

    # 3. สร้าง retriever
    retriever = multi_vectorstore.as_retriever(
        search_kwargs={"k": 5}
    )

    # 4. ต่อ RetrievalQA chain
    qa_chain = RetrievalQA.from_chain_type(
        llm=OpenAI(api_key=api_key),
        retriever=retriever,
        return_source_documents=True
    )

    # 5. ยิงคำถาม
    query = "ฉันชอบกินอะไร?"
    result = qa_chain.invoke(query)

    print(f'result: {result}')
