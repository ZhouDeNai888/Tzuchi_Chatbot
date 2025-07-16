from fastapi.middleware.gzip import GZipMiddleware
from fastapi import Query
import io
import asyncio
import json
import logging
import os
import sys
from fastapi.middleware.cors import CORSMiddleware
from typing import AsyncGenerator, List, Optional, Dict, Any
from fastapi.responses import JSONResponse
from fastapi.responses import StreamingResponse
from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Depends, Request, BackgroundTasks, Header, Body, Security
from pydantic import BaseModel, Field, EmailStr
from dotenv import load_dotenv
import secrets
from itsdangerous import URLSafeTimedSerializer
from starlette.middleware.sessions import SessionMiddleware
from starlette.status import HTTP_401_UNAUTHORIZED
import time
import os
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
import hashlib
from langchain.callbacks import AsyncIteratorCallbackHandler
from langchain_community.document_loaders import PyPDFLoader, TextLoader, CSVLoader, WebBaseLoader,Docx2txtLoader
import uuid
from contextlib import asynccontextmanager
import jwt  # PyJWT library
from datetime import datetime, timedelta
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm, HTTPBearer, HTTPAuthorizationCredentials
from urllib.parse import urlparse
import validators
from bs4 import BeautifulSoup
import requests
from ai_bot import RAG
from db import Database
from auto_crawl import crawl
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("server.log", encoding="utf-8")
    ]
)
logger = logging.getLogger("Server")

sys.stdin.reconfigure(encoding='utf-8')
sys.stdout.reconfigure(encoding='utf-8')


# Load environment variables
load_dotenv()
origin_whitelist = os.getenv("ORIGIN_WHITELIST", "").split(",")
print(f"origin_whitelist: {origin_whitelist}")
# models = os.getenv("MODEL_NAME", "").split(",")

jwt_secret = os.getenv("JWT_SECRET_KEY", secrets.token_hex(32))
jwt_algorithm = os.getenv("JWT_ALGORITHM", "HS256")
jwt_expiration = int(os.getenv("JWT_EXPIRATION_MINUTES", "1440"))  # 24 hours by default
 
# JWT Security
security = HTTPBearer()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/token")

# Global resources
thread_pool = ThreadPoolExecutor(max_workers=4)
model_cache = {}  # Structure: {model_name: {dept_id: {knowledge_base: {agent_key: {"model": instance, "retrieval": chain}}}}}
embedding_lock = asyncio.Lock()  # Lock for embedding operations

# Database connection
db = Database()
models = db.get_all_ai_models_name()



async def get_cached_model(model_name: str, dept_id: int, knowledge_base: str, agent_key: str) -> Optional[Any]:
    """Get a model and its retrieval chain from the cache"""
    try:
        
        cache_data = model_cache.get(model_name, {}).get(str(dept_id), {}).get(str(knowledge_base), {}).get(agent_key)
        if cache_data:
            return cache_data.get("model"), cache_data.get("retrieval")
        return None, None
    except Exception as e:
        logger.error(f"Error accessing model cache: {str(e)}")
        return None, None

async def cache_model(model_name: str, dept_id: int, knowledge_base: str, agent_key: str, model_instance: Any, retrieval_chain: Any = None):
    """Add a model and its retrieval chain to the cache"""
    try:
        # Clear any previous cache entries for this agent_key to prevent using outdated retrieval chains
        for model in model_cache.values():
            for dept in model.values():
                for kb in list(dept.keys()):
                    if agent_key in dept[kb]:
                        logger.info(f"Clearing previous cache entry for agent_key: {agent_key} in kb: {kb}")
                        del dept[kb][agent_key]
        
        # Set up cache structure
        if model_name not in model_cache:
            model_cache[model_name] = {}
        if str(dept_id) not in model_cache[model_name]:
            model_cache[model_name][str(dept_id)] = {}
        if str(knowledge_base) not in model_cache[model_name][str(dept_id)]:
            model_cache[model_name][str(dept_id)][str(knowledge_base)] = {}
        
        # ตรวจสอบว่า retrieval_chain เป็น coroutine หรือไม่
        # ถ้าเป็น coroutine ให้เตือนและไม่เก็บลงใน cache
        if asyncio.iscoroutine(retrieval_chain):
            logger.warning(f"Attempting to cache a coroutine for {agent_key}. This will be skipped to prevent 'cannot reuse already awaited coroutine' errors.")
            # สร้าง placeholder แทนที่จะเก็บ coroutine ลงไป
            retrieval_chain = None
        
        model_cache[model_name][str(dept_id)][str(knowledge_base)][agent_key] = {
            "model": model_instance,
            "retrieval": retrieval_chain
        }
        print(f'model_cache: {model_cache}')
        logger.info(f"Model and retrieval chain cached: {model_name} for dept {dept_id}, kb {knowledge_base}, agent {agent_key}")
    except Exception as e:
        logger.error(f"Error caching model: {str(e)}")



# Lifespan context manager for startup/shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Connect to the database at startup
    db.Conn_Sql()
    logger.info("Database connection established")
    
    try:
        # Get all active agents and knowledge bases
        agents = db.get_all_agents(active_only=True)
        knowledge_bases = db.get_all_knowledge_bases()
        logger.info(f"Found {len(agents)} active agents to initialize and {len(knowledge_bases)} knowledge bases to check")
        
        # Initialize RAG model for embeddings check
        rag = RAG()
        
        # Check and create embeddings for each knowledge base if needed
        for kb in knowledge_bases:
            kb_id = kb.get("KnowledgeBaseID")
            dept_id = kb.get("DepartmentID")
            
            # Check if embeddings exist - คอลเม็ธอดแบบ async
            embeddings_exist = await rag.check_embedding(dept_id=str(dept_id), knowledge_base_id=str(kb_id))
            if not embeddings_exist:
                logger.info(f"Missing embeddings for knowledge base {kb_id} in department {dept_id}, initializing...")
                try:
                    # Get all documents for this knowledge base
                    documents = db.get_documents_in_knowledge_base(kb_id)
                    if documents:
                        docs = []
                        for doc in documents:
                            file_path = doc.get("FileURL", "")
                            if file_path:
                                try:
                                    # Get file extension
                                    file_ext = os.path.splitext(file_path)[1].lower()
                                    
                                    # Load document based on file type
                                    if file_ext in ['.pdf']:
                                        loader = PyPDFLoader(file_path)
                                        file_docs = loader.load()
                                    elif file_ext in ['.txt', '.md', '.html', '.htm']:
                                        loader = TextLoader(file_path, encoding='utf-8')
                                        file_docs = loader.load()
                                    elif file_ext in ['.csv']:
                                        loader = CSVLoader(file_path)
                                        file_docs = loader.load()
                                    elif file_ext in ['.docx', '.doc']:
                                        loader = Docx2txtLoader(file_path)
                                        file_docs = loader.load()
                                    else:
                                        # For unsupported files, try as text
                                        loader = TextLoader(file_path, encoding='utf-8')
                                        file_docs = loader.load()
                                    
                                    # Add loaded docs to collection
                                    for d in file_docs:
                                        d.metadata.update({
                                            "source": file_path,
                                            "knowledge_base_id": kb_id,
                                            "department_id": dept_id,
                                            "title": doc.get("Title", "")
                                        })
                                        docs.append(d)
                                except Exception as e:
                                    logger.error(f"Error loading document {file_path}: {str(e)}")
                                    continue
                            else:
                                # If no file URL, create document from content
                                docs.append(Document(
                                    page_content=doc.get("Content", ""),
                                    metadata={
                                        "source": doc.get("FileURL", ""),
                                        "knowledge_base_id": kb_id,
                                        "department_id": dept_id,
                                        "title": doc.get("Title", "")
                                    }
                                ))
                        
                        if docs:
                            # Create embeddings - เรียกเมธอด async
                            result = await rag.embeddings(
                                docs=docs,
                                dept_id=str(dept_id),
                                knowledge_base_id=str(kb_id)
                            )
                            if result != "notfound":
                                logger.info(f"Successfully created embeddings for knowledge base {kb_id}")
                            else:
                                logger.warning(f"Failed to create embeddings for knowledge base {kb_id}")
                    else:
                        logger.info(f"No documents found for knowledge base {kb_id}")
                except Exception as e:
                    logger.error(f"Error creating embeddings for knowledge base {kb_id}: {str(e)}")
        
        # Initialize and cache each agent
        for agent in agents:
            try:
                # Get agent configuration
                config = json.loads(agent.get("Configuration", "{}"))
                model_name = config.get("model")
                knowledge_base = config.get("knowledge_base_ids")
                dept_id = agent.get("DepartmentID", 1)
                agent_key = agent.get("AgentKey")
                
                # Initialize model instance and retrieval chain
                model_instance = RAG()
                platform = db.get_platform(model_name)
                # เรียกเมธอด retrieval แบบ async
                retrieval_chain = await model_instance.retrieval(
                    model_name=model_name,
                    dept_id=str(dept_id),
                    knowledge_base_id=knowledge_base,
                    prompt=config.get("system_prompt", ""),
                    nftext=config.get("nftext", "Sorry, no information found"),
                    temperature=config.get("temperature", 0.5),
                    max_tokens=config.get("max_tokens", 1024),
                    platform=platform
                )
                
                if retrieval_chain != "notfound":
                    # Cache both model and retrieval chain
                    await cache_model(
                        model_name=model_name,
                        dept_id=dept_id,
                        knowledge_base=knowledge_base,
                        agent_key=agent_key,
                        model_instance=model_instance,
                        retrieval_chain=retrieval_chain
                    )
                    logger.info(f"Initialized and cached agent with retrieval: {agent.get('Name')} ({agent.get('AgentKey')})")
                else:
                    logger.warning(f"Skipped caching agent due to missing data: {agent.get('Name')} ({agent.get('AgentKey')})")
            except Exception as e:
                logger.error(f"Failed to initialize agent {agent.get('Name')}: {str(e)}")
    except Exception as e:
        logger.error(f"Error in startup: {str(e)}")
    
    yield
    
    # Close database connection at shutdown
    db.close_connection()
    logger.info("Database connection closed")

app = FastAPI(lifespan=lifespan)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=origin_whitelist,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token", "Authorization","x-api-key"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(SessionMiddleware, secret_key=jwt_secret)

# --- Pydantic Models for API requests/responses ---

class TokenRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    user_role: str
    username: str
    expires_at: int  # Unix timestamp for token expiration

class Department(BaseModel):
    department_id: int
    name: str
    description: Optional[str] = None
    user_count: Optional[int] = 0
    knowledgebase_count: Optional[int] = 0
    created_at: Optional[datetime] = None
    last_updated_at: Optional[datetime] = None

class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    department_ids: Optional[List[int]] = None
    permissions: Optional[List[str]] = None
    user_role:str

class ChatMessage(BaseModel):
    content: str
    role: str = "user"

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: str
    department_id: int
    conversation_id: Optional[int] = None
    stream: bool = True
    agent_key: Optional[str] = None
    chat_id: Optional[str] = None  # Added chat_id to match usage

class ConversationRequest(BaseModel):
    title: Optional[str] = None
    department_id: Optional[int] = None

class EmbeddingRequest(BaseModel):
    department_id: int
    document_ids: Optional[List[int]] = None
    regenerate: bool = False

class Agent(BaseModel):
    agent_id: int
    agent_key: str
    name: str
    description: Optional[str] = None
    configuration: Optional[str] = None
    is_active: bool = True
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    is_global: bool = False
    created_at: Optional[datetime] = None
    last_updated_at: Optional[datetime] = None


class AgentRequest(BaseModel):
    department_id: Optional[int] = None
    include_global: bool = True
    active_only: bool = True

class AgentCreate(BaseModel):
    agent_key: str
    name: str
    description: Optional[str] = None
    configuration: Optional[str] = None
    is_active: bool = True
    department_id: Optional[int] = None
    is_global: bool = False

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    configuration: Optional[str] = None
    is_active: Optional[bool] = None
    department_id: Optional[int] = None
    is_global: Optional[bool] = None
    agent_key: Optional[str] = None

class KnowledgeBase(BaseModel):
    knowledge_base_id: int
    name: str
    description: Optional[str] = None
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    is_public: bool = False
    is_global: bool = False
    document_count: Optional[int] = 0
    created_at: Optional[datetime] = None
    last_updated_at: Optional[datetime] = None

class KnowledgeBaseCreate(BaseModel):
    name: str
    description: Optional[str] = None
    department_id: Optional[int] = None
    is_public: bool = False
    is_global: bool = False

class KnowledgeBaseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    department_id: Optional[int] = None
    is_public: Optional[bool] = None
    is_global: Optional[bool] = None

class Document(BaseModel):
    document_id: int
    knowledge_base_id: int
    title: str
    content: Optional[str] = None
    file_url: Optional[str] = None
    file_type: Optional[str] = None
    is_processed: bool = False
    created_at: Optional[datetime] = None
    last_updated_at: Optional[datetime] = None

class DocumentCreate(BaseModel):
    knowledge_base_id: int
    title: Optional[str] = None  # Optional because we'll get it from web page if not provided
    file_url: Optional[str] = None  # Can be either a web URL or will be set for uploaded files
    file_type: Optional[str] = None

class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    file_url: Optional[str] = None
    file_type: Optional[str] = None
    is_processed: Optional[bool] = None

class Permission(BaseModel):
    permission_id: int = None
    permission_name: str
    description: Optional[str] = None

class PermissionRequest(BaseModel):
    permission_name: str
    user_id: Optional[int] = None  # Optional, will use current user if not provided

class MessageFeedback(BaseModel):
    feedback: str

class FixPermission(BaseModel):
    permission_name: str
    description: str

class Route(BaseModel):
    path: str
    methods: List[str]
    summary: Optional[str] = None
    description: Optional[str] = None

class APIPermission(BaseModel):
    ApiPermissionID: int = None
    RequiredPermission: str
    Method: str
    PathPattern: str

# --- JWT Functions ---

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Generate a new JWT token"""
    to_encode = data.copy()
    print(f"to_encode: {to_encode}")
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=jwt_expiration)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, jwt_secret, algorithm=jwt_algorithm)
    
    print(f"encoded_jwt: {encoded_jwt}")

    return encoded_jwt, int(expire.timestamp())

def verify_token(token: str):
    """Verify JWT token and extract user info"""
    try:
        payload = jwt.decode(token, jwt_secret, algorithms=[jwt_algorithm])
        user_id = payload.get("sub")
        user_role = payload.get("role")
        username = payload.get("username")
        
        if user_id is None:
            return None
        
        print(f"Decoded payload: {payload}")
        return {"user_id": int(user_id), "role": user_role, "username": username}
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )


        
def generate_api_key(agent_id: int, user_id: int, allowed_origins: List[str], usage_limit: int, expires_at: datetime) -> str:
    """Generate a random API key with additional parameters."""
    print(f'expires_at: {expires_at}')
    payload = {
        "agent_id": agent_id,
        "user_id": user_id,
        "allowed_origins": allowed_origins,
        "usage_limit": usage_limit,
    }
    if expires_at is not None:
        payload["exp"] = int(expires_at)
    return jwt.encode(payload, jwt_secret, algorithm=jwt_algorithm)

def verify_api_key(api_key: str):
    """Verify if the provided API key is valid."""
    
    try:
        decoded = jwt.decode(api_key, jwt_secret, algorithms=[jwt_algorithm])
        print(f'decoded: {decoded}')
        agent_id = decoded.get("agent_id")
        if (agent_id):
            return decoded
        else:
            return False
    
    except jwt.ExpiredSignatureError as e:
        logger.error(f"API key expired: {str(e)}")
        return False
    except jwt.InvalidTokenError as e:
        logger.error(f"Invalid API key: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Error verifying API key: {str(e)}")
        return False

async def get_current_user(request: Request,credentials: HTTPAuthorizationCredentials = Security(security), x_api_key: Optional[str] = Header(None)):
    """Validate token and get user information"""
    logger.debug(f'Authentication credentials: {credentials}')
    logger.debug(f'X-API-Key: {x_api_key}')
    
    # Priority 1: Check for API key first (if provided)
    if x_api_key is not None:
        api_key_data = verify_api_key(x_api_key)
        if api_key_data:
            logger.info(f"User authenticated via API key")
            return api_key_data
    
    # Priority 2: Check for JWT token
    if credentials and credentials.credentials != 'undefined':
        token = credentials.credentials
        user = verify_token(token)
        if user is not None:
            # สมมุติว่าคุณมีตัวแปร request จาก middleware
            parsed_url = urlparse(str(request.url))
            path = parsed_url.path  # เช่น "/api/knowledge/1"
            method = request.method # เช่น "GET"
            
            check_permission = db.check_user_permissions_pattern(
                user_id=user.get("user_id"),
                path=path,
                method=method
            )
            logger.info(f"User authenticated via JWT token: {user.get('username')}")
            if check_permission:
                logger.info(f"User has permission for this route: {check_permission}")
                print(f"User has permission for this route: {check_permission}")
                return user
        else:
            logger.warning("Invalid JWT token provided.")
        
    
    # Authentication failed
    raise HTTPException(
        status_code=HTTP_401_UNAUTHORIZED,
        detail="Authentication failed. Valid credentials were not provided.",
        headers={"WWW-Authenticate": "Bearer"},
    )

# --- Helper Functions ---

async def process_chat_non_streaming(
    messages: List[ChatMessage],
    model_name: str,
    department_id: int,
    knowledge_base_id: int,
    temperature: float,
    max_tokens: int,
    prompt: str,
    agent_key: str,
    nftext: str 
) -> str:
    
    print(f'*************************************       non-streaming           *********************************************')
    try:
        # Get or initialize model and retrieval chain
        model_instance, retrieval_chain = await get_cached_model(model_name, department_id, knowledge_base_id, agent_key)
        if not model_instance:
            print("Model not found in cache, creating new instance in non-streaming")
            model_instance = RAG()
            platform = db.get_platform(model_name)
            # Create retrieval chain with parameters
            retrieval_chain = await model_instance.retrieval(
                model_name=model_name,
                dept_id=department_id,
                knowledge_base_id=knowledge_base_id, 
                prompt=prompt,
                nftext=nftext,
                temperature=temperature,
                max_tokens=max_tokens,
                platform=platform
            )
            if retrieval_chain == "notfound":
                return "ยังไม่มีข้อมูลในระบบ กรุณาเพิ่มข้อมูลก่อนใช้งาน"
            
            await cache_model(model_name, department_id, knowledge_base_id, agent_key, model_instance, retrieval_chain)
        
        # Format chat history
        chat_history = []
        if len(messages) > 1:
            for msg in messages[:-1]:
                chat_history.append((msg.role, msg.content))
        
        current_message = messages[-1].content
        
        response = await retrieval_chain.ainvoke({
            "input": current_message,
            "chat_history": chat_history
        })

        print(f'response: {response}')  
        
        print(f"-------------------------Response context: {response.get('context')}")
        return response.get("answer", "ขออภัย เกิดข้อผิดพลาดในการประมวลผล")
    
    except Exception as e:
        logger.error(f"Error in chat processing: {str(e)}")
        return f"เกิดข้อผิดพลาด: {str(e)}"

async def process_chat_streaming(
    messages: List[ChatMessage],
    model_name: str,
    department_id: int,
    knowledge_base_id: int,
    temperature: float,
    max_tokens: int,
    prompt: str,
    agent_key: str ,
    nftext: str,
    chat_id:str
) -> AsyncGenerator[str, None]:
    print(f'*************************************       streaming           *********************************************')
    try:
        # First try to find any cached model for this agent_key regardless of other parameters
        cached_model = None
        cached_retrieval = None
        
        # If chat_id is provided, load existing chat history
        loaded_chat_history = []
        if chat_id:
            loaded_chat_history = await load_chat_history(chat_id)
            if loaded_chat_history:
                logger.info(f"Using existing chat history for chat_id: {chat_id}")
        
        # Search through all cached models for matching agent_key
        for model in model_cache.values():
            for dept in model.values():
                for kb in dept.values():
                    if agent_key in kb:
                        cached_data = kb[agent_key]
                        cached_model = cached_data.get("model")
                        cached_retrieval = cached_data.get("retrieval")
                        break
                if cached_model:
                    break
            if cached_model:
                break
        
        if cached_model and cached_retrieval:
            model_instance = cached_model
            # ตรวจสอบว่า cached_retrieval เป็น coroutine หรือไม่
            if asyncio.iscoroutine(cached_retrieval):
                # ถ้าเป็น coroutine ให้ await ก่อน
                retrieval_chain = await cached_retrieval
            else:
                # ถ้าไม่ใช่ coroutine ใช้ได้เลย
                retrieval_chain = cached_retrieval
        else:
            print("Model not found in cache, creating new instance in stream")
            # If not found in cache, create new model instance
            model_instance = RAG()
            platform = db.get_platform(model_name)
            # Create retrieval chain with parameters
            retrieval_chain = await model_instance.retrieval(
                model_name=model_name,
                dept_id=department_id,
                knowledge_base_id=knowledge_base_id,
                prompt=prompt,
                nftext=nftext,
                temperature=temperature,
                max_tokens=max_tokens,
                platform=platform
            )
 
            print(f"Retrieval chain: {retrieval_chain}")
            
            if retrieval_chain == "notfound":
                yield "ยังไม่มีข้อมูลในระบบ กรุณาเพิ่มข้อมูลก่อนใช้งาน"
                return
            
            # เก็บผลลัพธ์ที่ได้จาก await แล้วลงใน cache
            await cache_model(model_name, department_id, knowledge_base_id, agent_key, model_instance, retrieval_chain)
        
        # ตรวจสอบว่า retrieval_chain มี method astream หรือไม่
        if not hasattr(retrieval_chain, 'astream'):
            yield f"เกิดข้อผิดพลาด: retrieval_chain ไม่มี method astream (type: {type(retrieval_chain)})"
            return
            
        # Format chat history
        chat_history = []
        if loaded_chat_history:
            # Use the loaded chat history if available
            chat_history = loaded_chat_history
        elif len(messages) > 1:
            # Otherwise use the provided messages
            for msg in messages[:-1]:
                chat_history.append((msg.role, msg.content))
        
        current_message = messages[-1].content
        print(f'chat_history: {chat_history}')
        # Create the astream generator from the retrieval chain
        async_stream = retrieval_chain.astream({
            "input": current_message,
            "chat_history": chat_history
        })
        
        full_answer = ""
        full_context = ""
        unique_sources = []  # Use a list to store unique source URLs
        
        # Process the async stream
        async for chunk in async_stream:
            if answer_chunk := chunk.get("answer"):
                full_answer += answer_chunk
                print(f"Answer chunk: {answer_chunk}")
                yield json.dumps({'answer_chunk': answer_chunk}) + "\n"
                await asyncio.sleep(0.1)
            
            if context_chunk := chunk.get("context"):
                full_context = context_chunk
                
                # Extract source URLs and titles from context documents
                if isinstance(context_chunk, list) and len(context_chunk) > 0:
                    # Handle case where context is a list of Document objects
                    for doc in context_chunk:
                        if hasattr(doc, 'metadata') and doc.metadata:
                            source_url = doc.metadata.get('source')
                            source_title = doc.metadata.get('title', 'Untitled')
                            if source_url:
                                # Encode both title and source to UTF-8 if they're strings
                                if isinstance(source_title, str):
                                    source_title = source_title.encode('utf-8', errors='replace').decode('utf-8')
                                if isinstance(source_url, str):
                                    source_url = source_url.encode('utf-8', errors='replace').decode('utf-8')
                                unique_sources.append({"unique_title": source_title, "unique_source": source_url})
                
                # Also check if there's a source field directly in the chunk
                if source := chunk.get("source"):
                    # Handle different source formats
                    if isinstance(source, list):
                        for src in source:
                            if isinstance(src, dict):
                                title = src.get('title', 'Untitled')
                                url = src.get('source')
                                # Encode to UTF-8
                                if isinstance(title, str):
                                    title = title.encode('utf-8', errors='replace').decode('utf-8')
                                if isinstance(url, str):
                                    url = url.encode('utf-8', errors='replace').decode('utf-8')
                                unique_sources.append({"unique_title": title, "unique_source": url})
                            elif isinstance(src, str):
                                # Encode to UTF-8
                                if isinstance(src, str):
                                    src = src.encode('utf-8', errors='replace').decode('utf-8')
                                unique_sources.append({"unique_title": "Untitled", "unique_source": src})
                    elif isinstance(source, dict):
                        title = source.get('title', 'Untitled')
                        url = source.get('source')
                        # Encode to UTF-8
                        if isinstance(title, str):
                            title = title.encode('utf-8', errors='replace').decode('utf-8')
                        if isinstance(url, str):
                            url = url.encode('utf-8', errors='replace').decode('utf-8')
                        unique_sources.append({"unique_title": title, "unique_source": url})
                    elif isinstance(source, str):
                        # Encode to UTF-8
                        if isinstance(source, str):
                            source = source.encode('utf-8', errors='replace').decode('utf-8')
                        unique_sources.append({"unique_title": "Untitled", "unique_source": source})

                print(f"Context: {full_context}")
                print(f"Unique sources so far: {unique_sources}")
         
        # At the end of streaming, send a list of unique source URLs
        if unique_sources:
            # Remove duplicates by converting to dict using source URL as key
            source_dict = {}
            for source in unique_sources:
                key = source["unique_source"]
                if key not in source_dict:
                    source_dict[key] = source
            
            # Convert back to list with no duplicates
            source_list = list(source_dict.values())
            yield json.dumps({"sources": source_list}, ensure_ascii=False) + "\n"
        
        # Save updated chat history with new messages
        if chat_id:
            # Add the current message and AI response to history
            updated_messages = list(messages)  # Create a copy of the messages
            # Add AI response as a new message
            updated_messages.append(ChatMessage(role="assistant", content=full_answer))
            # Save the updated chat history
            await save_chat_history(chat_id, updated_messages)
            logger.info(f"Updated chat history for chat_id: {chat_id}")
    
    except KeyError as ke:
        logger.error(f"KeyError in streaming chat: Missing key {ke}")
        if str(ke) == "'context'":
            # Gracefully handle missing context key
            yield f"เกิดข้อผิดพลาด: ไม่พบข้อมูลบริบทในคำตอบ"
        else:
            yield f"เกิดข้อผิดพลาด: ไม่พบข้อมูลสำคัญในคำตอบ ({str(ke)})"
    except Exception as e:
        logger.error(f"Error in streaming chat: {str(e)}")
        yield f"เกิดข้อผิดพลาด: {str(e)}"

# --- API Routes ---

@app.post("/api/token", response_model=TokenResponse)
async def login_for_access_token(request: TokenRequest):
    """Authenticate user and generate JWT access token"""
    user = db.authenticate_user(request.username, request.password)
    print(f"User: {user}")
    
    if 'error_code' in user:
        print(user.keys())
        print(user['error_message'])
        raise HTTPException(
            status_code=HTTP_401_UNAUTHORIZED,
            detail=user['error_message'],
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create JWT token with user data
    print(user)
    token_data = {
        "sub": str(user[0]) if isinstance(user[0], int) else str(user[0]),
        "username": request.username,
        "role": user[2] if not isinstance(user[2], int) else "user"  # Default to user role if not available
    }
    print(f"Token data: {token_data}")
    
    access_token, expires_at = create_access_token(token_data)
    print(f"Access token: {access_token}")
    print(f"Expires at: {expires_at}")
    decode = verify_token(access_token)
    print(f"Decoded token: {decode}")
    print({
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user[0] if isinstance(user[0], int) else user[0],
        "user_role": user[2] if not isinstance (user[2], int) else "user",
        "username": request.username,
        "expires_at": expires_at
    })
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user[0] if isinstance(user[0], int) else user[0],
        "user_role": user[2] if not isinstance (user[2], int) else "user",
        "username": request.username,
        "expires_at": expires_at
    }

@app.post("/api/users", response_model=dict)
async def create_user(user: UserCreate):
    """Create a new user"""
    user_id = db.create_user(
        username=user.username,
        email=user.email,
        password=user.password,
        first_name=user.first_name,
        last_name=user.last_name,
        department_ids=user.department_ids,
        permissions=user.permissions,
        user_role=user.user_role
    )
    
    if not user_id:
        raise HTTPException(
            status_code=400,
            detail="Failed to create user. Username or email may already exist."
        )
    
    return {"user_id": user_id, "message": "User created successfully"}

@app.get("/api/users/me")
async def get_current_user_details(user = Depends(get_current_user)):
    """Get details for the currently authenticated user"""
    print(f'get_current_user_details: {user}')
    user_details = db.get_user_details(user["user_id"])
    
    if not user_details:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Remove sensitive information
    if "PasswordHash" in user_details:
        del user_details["PasswordHash"]
    
    return user_details

@app.get("/api/users")
async def get_users(user = Depends(get_current_user)):
    """
    Get a list of users. Admin users can see all users, regular users only see themselves.
    
    Returns:
        List of users with basic information
    """
    # Check if user has permission to view users
    if user["role"] != "admin":
        # Regular users can only see their own data
        users_data = [db.get_user_details(user["user_id"])]
    else:
        # Admin users can see all users
        users_data = db.get_all_users()
    
    if not users_data:
        return {"users": []}
    
    # Clean user data for response
    users = []
    for user_data in users_data:
        if user_data:
            # Remove sensitive information
            if "PasswordHash" in user_data:
                del user_data["PasswordHash"]
            users.append(user_data)
    
    return {"users": users}

@app.get("/api/users/all", response_model=dict)
async def get_all_user_details(user = Depends(get_current_user)):
    """
    Get detailed information for all users including their departments and permissions.
    Only admins can access this endpoint.
    
    Returns:
        Dictionary containing a list of all users with their detailed information
    """
    print(user)
    # Check if user has admin permissions
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access detailed information for all users")
    
    # Get detailed information for all users
    users_data = db.get_all_user_details()
    
    if not users_data:
        return {"users": []}
    
    # Clean user data for response (remove sensitive information)
    users = []
    for user_data in users_data:
        if user_data and "PasswordHash" in user_data:
            del user_data["PasswordHash"]
        users.append(user_data)
    
    return {"users": users}

@app.get("/api/users/{user_id}")
async def get_user(user_id: int, user = Depends(get_current_user)):
    """
    Get details for a specific user by ID.
    
    Args:
        user_id: The ID of the user to retrieve
        
    Returns:
        User details
    """
    # Check if user has permission to view this user
    if user["role"] != "admin" and str(user_id) != str(user["user_id"]):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    user_data = db.get_user_details(user_id)
    
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Remove sensitive information
    if "PasswordHash" in user_data:
        del user_data["PasswordHash"]
    
    return user_data

@app.put("/api/users/{user_id}")
async def update_user(
    user_id: int,
    update_data: dict,
    user = Depends(get_current_user)
):
    """
    Update a user's information.
    
    Args:
        user_id: ID of the user to update
        update_data: Updated user data
        
    Returns:
        Updated user details
    """
    # Check if user has permission to update this user
    if user["role"] != "admin" and str(user_id) != str(user["user_id"]):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # If not admin, restrict what fields can be updated
    if user["role"] != "admin" and str(user_id) == str(user["user_id"]):
        # Regular users can only update specific fields for themselves
        allowed_fields = ["username", "email", "password", "first_name", "last_name"]
        update_data = {k: v for k, v in update_data.items() if k in allowed_fields}
    
    print(f'update_data: {update_data}')
    # Update the user
    success = db.update_user(user_id, **update_data)
    
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Failed to update user"
        )
    
    # Get updated user data
    updated_user = db.get_user_details(user_id)
    
    # Remove sensitive information
    if "PasswordHash" in updated_user:
        del updated_user["PasswordHash"]
    
    return updated_user

@app.delete("/api/users/{user_id}")
async def delete_user(
    user_id: int,
    user = Depends(get_current_user)
):
    """
    Delete a user.
    
    Args:
        user_id: ID of the user to delete
        
    Returns:
        Success message
    """
    # Only admins can delete users
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Check if the user exists
    user_data = db.get_user_details(user_id)
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deleting your own account
    if str(user_id) == str(user["user_id"]):
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Delete the user
    success = db.delete_user(user_id)
    
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Failed to delete user"
        )
    
    return {"status": "success", "message": f"User with ID {user_id} deleted successfully"}

@app.post("/api/token/refresh", response_model=TokenResponse)
async def refresh_access_token(user = Depends(get_current_user)):
    """Refresh the access token"""
    # Create a new token with extended expiration
    token_data = {
        "sub": str(user["user_id"]),
        "username": user["username"],
        "role": user["role"]
    }
    
    access_token, expires_at = create_access_token(token_data)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user["user_id"],
        "user_role": user["role"],
        "username": user["username"],
        "expires_at": expires_at
    }

@app.get("/api/models")
async def get_available_models(user = Depends(get_current_user)):
    """Get list of available models from environment configuration"""
    try:
        models = db.get_all_ai_models_name()
        if not models:
            raise HTTPException(status_code=404, detail="No AI models available")
        available_models = models
        return {"models": available_models}
    except Exception as e:
        logger.error(f"Error getting available models: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get available models")


@app.get("/api/all_models")
async def get_all_models(user = Depends(get_current_user)):
    models = db.get_all_ai_models()
    """Get all AI models from the database"""
    if not models:
        raise HTTPException(status_code=404, detail="No AI models found")
    return models


@app.post("/api/models", response_model=dict)
async def create_model(
    platform: str = Body(..., embed=True),
    model_name: str = Body(..., embed=True),
    api_key: Optional[str] = Body(None, embed=True),
    api_version: Optional[str] = Body(None, embed=True),
    created_by: int = Body(..., embed=True),
    user = Depends(get_current_user),
    background_tasks: BackgroundTasks = None
):
    """Create a new AI model"""
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Permission denied")
    
    print(f'Creating model: {model_name} on platform: {platform} by user: {created_by}')
    try:
        # Create the model record in the database first
        model_id = db.create_ai_model(
            platform=platform,
            model_name=model_name,
            created_by=created_by,
            apiKey=api_key,
            apiVersion=api_version
        )
        if not model_id:
            raise HTTPException(status_code=400, detail="Failed to create model. Model name may already exist.")
        
        # Pull model from Ollama in the background if it's not a GPT model
        if "gpt" not in model_name:
            # Define the background task for pulling the model
            async def pull_model_in_background(model_name):
                try:
                    import httpx
                    async with httpx.AsyncClient() as client:
                        response = await client.post("http://ollama:11434/api/pull", json={"name": model_name})
                        
                        if response.status_code == 200:
                            print(f"✅ Model {model_name} pulled successfully in background")
                        else:
                            print(f"❌ Background pull failed for model {model_name}: {response.text}")
                except Exception as e:
                    logger.error(f"Error in background model pull: {str(e)}")
            
            # Add the task to run in the background
            if background_tasks:
                background_tasks.add_task(pull_model_in_background, model_name)
            else:
                # Fall back to a thread if background_tasks is not available
                import threading
                threading.Thread(target=lambda: asyncio.run(pull_model_in_background(model_name)), daemon=True).start()
        
        return {"status": "success", "message": f"Model '{model_name}' created successfully. If this is an Ollama model, it will be pulled in the background.", "model_id": model_id}
    except Exception as e:
        logger.error(f"Error creating model: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create model")


@app.delete("/api/models", response_model=dict)
async def delete_model(model_id: int = Body(..., embed=True), user = Depends(get_current_user)):
    """Delete an AI model"""
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Permission denied")
    
    try:
        success = db.delete_ai_model(model_id=model_id)
        if not success:
            raise HTTPException(status_code=404, detail="Model not found")
        return {"status": "success", "message": f"Model with ID {model_id} deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting model: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete model")

@app.post("/api/agents", response_model=Agent)
async def create_agent(
    agent: AgentCreate,
    user = Depends(get_current_user)
):
    """Create a new AI agent."""
    try:
        # # Check permissions
        # if user["role"] != "admin":
        #     has_permission = db.check_user_has_permission(
        #         user_id=user["user_id"],
        #         permission_name="use_agent"  # Adjust this to your permission name
        #     )
        #     if not has_permission:
        #         raise HTTPException(status_code=403, detail="Permission denied")
        
        # Validate and parse configuration
        if agent.configuration:
            config = json.loads(agent.configuration)
            print(config)
            try:
                
                model_name = config.get("model")
                knowledge_base_id = config.get("knowledge_base_ids")
                models = db.get_all_ai_models_name()
                # Check if model is supported
                if not model_name or model_name not in models:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Unsupported model: {model_name}. Supported models: {', '.join(models)}"
                    )
                


                # Initialize and cache model
                dept_id = agent.department_id or 1
                model_instance = RAG()
                platform = db.get_platform(model_name)
                retrieval_chain = model_instance.retrieval(
                    model_name=model_name,
                    dept_id=str(dept_id),
                    knowledge_base_id=knowledge_base_id,
                    prompt=config.get("prompt", ""),
                    nftext=config.get("nftext", "Sorry, no information found"),
                    temperature=config.get("temperature", 0.5),
                    max_tokens=config.get("max_tokens", 1024)
                    , platform=platform
                )
                
                if retrieval_chain == "notfound":
                    raise HTTPException(
                        status_code=400,
                        detail="Failed to initialize retrieval chain"
                    )
                
                # Cache the model and chain
                await cache_model(
                    model_name=model_name,
                    dept_id=dept_id,
                    knowledge_base=knowledge_base_id,
                    agent_key=agent.agent_key,
                    model_instance=model_instance,
                    retrieval_chain=retrieval_chain
                )
                
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid configuration JSON format"
                )
        
        # Create the agent in database
        agent_id = db.create_agent(
            agent_key=agent.agent_key,
            name=agent.name,
            description=agent.description,
            configuration=agent.configuration,
            is_active=agent.is_active,
            department_id=agent.department_id,
            is_global=agent.is_global
        )
        
        if not agent_id:
            raise HTTPException(
                status_code=400, 
                detail="Failed to create agent. Agent key may already exist."
            )
        
        # Get the created agent details
        agent_data = db.get_agent(agent_id=agent_id)
        
        return Agent(
            agent_id=agent_data.get("AgentID"),
            agent_key=agent_data.get("AgentKey"),
            name= agent_data.get("Name"),
            description=agent_data.get("Description"),
            configuration=agent_data.get("Configuration"),
            is_active=bool(agent_data.get("IsActive")),
            department_id=agent_data.get("DepartmentID"),
            department_name=agent_data.get("DepartmentName"),
            is_global=bool(agent_data.get("IsGlobal")),
            created_at=agent_data.get("CreatedAt"),
            last_updated_at=agent_data.get("LastUpdatedAt")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating agent: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest, user = Depends(get_current_user)):
    if not request.messages:
        raise HTTPException(status_code=400, detail="No messages provided")

    model_name = request.model
    
    # Initialize variables with default values
    knowledge_base_id = None
    temperature = 0.5
    max_tokens = 1024
    prompt = ""
    department_id = request.department_id
    agent_key = request.agent_key
    chat_id = request.chat_id
    
    if request.conversation_id:
        conversation = db.get_conversation(request.conversation_id)
        if conversation:
            knowledge_base_id = conversation.get("KnowledgeBaseID", 1)
            # Get agent configuration
            agent_id = conversation.get("agent_id")
            if agent_id:
                agent = db.get_agent(agent_id)
                if agent and agent.get("Configuration"):
                    config = json.loads(agent.get("Configuration"))
                    temperature = config.get("temperature", 0.5)
                    max_tokens = config.get("max_tokens", 1024)
                    prompt = config.get("prompt", "")
                    model_name = config.get("model")
                    agent_key = agent.get("AgentKey", "default")
    
    # Get agent configuration if agent_key is provided
    if agent_key and not request.conversation_id:
        agent_config = db.get_agent(agent_key=agent_key)
        
        if not agent_config:
            raise HTTPException(status_code=400, detail=f"Agent with key '{agent_key}' not found")
        
        # Extract configuration
        try:
            config = json.loads(agent_config.get("Configuration", "{}"))
            model_name = config.get("model")
            knowledge_base_id = config.get("knowledge_base_ids")
            temperature = config.get("temperature", 0.5)
            max_tokens = config.get("max_tokens", 1024)
            prompt = config.get("prompt", "")
            department_id = agent_config.get("DepartmentID") 
            nftext = config.get("nftext", "Sorry, no information found")
        except Exception as e:
            logger.error(f"Error parsing agent configuration: {str(e)}")
            raise HTTPException(status_code=500, detail="Invalid agent configuration")
    models = db.get_all_ai_models_name()
    # Verify model is supported
    if not model_name or model_name not in models:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid or missing model. Supported models: {', '.join(models)}"
        )

    # Save conversation if new
    if not request.conversation_id and len(request.messages) == 1:
        conversation_title = f"Chat {time.strftime('%Y-%m-%d %H:%M:%S')}"
        request.conversation_id = db.create_conversation(
            user_id=user["user_id"],
            title=conversation_title,
            department_id=department_id,
        )

    print(f'*******************************agent_key: {agent_key}')  
    print(f'*******************************model_name: {model_name}')
    print(f'*******************************knowledge_base_id: {knowledge_base_id}')
    print(f'*******************************temperature: {temperature}')
    print(f'*******************************max_tokens: {max_tokens}')
    print(f'*******************************prompt: {prompt}')
    print(f'*******************************department_id: {department_id}')
    print(f'*******************************conversation_id: {request.conversation_id}')
      
    # Handle streaming/non-streaming responses with parameters
    if request.stream:
        # Save user message first
        user_mes_id = db.add_message_to_conversation(
            conversation_id=request.conversation_id,
            sender_type="user",
            sender_id=user["user_id"],
            content=request.messages[-1].content,
            agent_key=agent_key,
        )

        async def stream_with_save():
            # Stream the response
            full_response = ""
            async for chunk in process_chat_streaming(
                request.messages,
                model_name,
                department_id,
                knowledge_base_id,
                temperature,
                max_tokens,
                prompt,
                agent_key,
                nftext,
                chat_id
            ):
                yield chunk
                try:
                    chunk_data = json.loads(chunk)
                    if "answer_chunk" in chunk_data:
                        full_response += chunk_data["answer_chunk"]
                except:
                    pass

            # Save bot response
            agent_mes_id = db.add_message_to_conversation(
                conversation_id=request.conversation_id,
                sender_type="agent",
                sender_id=agent_config.get("AgentID"),  # Use the agent ID from config
                content=full_response,
                agent_key=agent_key,
            )

            # Final event with agent_msg_id
            yield json.dumps({"agent_msg_id": agent_mes_id}) + "\n"

        return StreamingResponse(
            stream_with_save(),
            media_type="text/event-stream",
            headers={
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Transfer-Encoding": "chunked",
                "X-Accel-Buffering": "no",
                "Content-Encoding": "identity",  # 🔥 ปิด gzip
            }
        )
    
    response_text = await process_chat_non_streaming(
        request.messages,
        model_name,
        department_id,
        knowledge_base_id,
        temperature,
        max_tokens,
        prompt,
        agent_key,
        nftext
    )
    
    # Save messages to database if conversation exists
    if request.conversation_id:
        # Save user message
        user_mes_id = db.add_message_to_conversation(
            conversation_id=request.conversation_id,
            sender_type="user",
            sender_id=user["user_id"],
            content=request.messages[-1].content,
            agent_key=agent_key,
        )
        
        # Save bot response
        agent_mes_id = db.add_message_to_conversation(
            conversation_id=request.conversation_id,
            sender_type="agent",
            sender_id=agent_config.get("AgentID"),  # Use the agent ID from config
            content=response_text,
            agent_key=agent_key,
        )

        print(f"++++++++++++++++++++++++++++User message ID: {user_mes_id}, Agent message ID: {agent_mes_id}")
    
    return JSONResponse({"content": response_text, "agent_msg_id": agent_mes_id})

@app.post("/api/conversations")
async def create_conversation(
    request: ConversationRequest,
    user = Depends(get_current_user)
):
    conversation_id = db.create_conversation(
        user_id=user["user_id"],
        title=request.title or f"Chat {time.strftime('%Y-%m-%d %H:%M:%S')}",
        department_id=request.department_id
    )

    print(f'Creating conversation: {request.title} for user: {user["user_id"]} in department: {request.department_id}')
    
    # if not conversation_id:
    #     raise HTTPException(status_code=500, detail="Failed to create conversation server-side")
    
    return {"conversation_id": conversation_id}

@app.get("/api/conversations")
async def get_conversations(user = Depends(get_current_user)):
    conversations = db.get_user_conversations(user["user_id"])
    return {"conversations": conversations}

@app.get("/api/conversations/{conversation_id}")
async def get_conversation(conversation_id: int, user = Depends(get_current_user)):
    conversation = db.get_conversation(conversation_id)
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Check if user has access to this conversation
    if conversation.get("UserID") != user["user_id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    return conversation

@app.delete("/api/conversations/{conversation_id}")
async def delete_conversation(conversation_id: int, user = Depends(get_current_user)):
    conversation = db.get_conversation(conversation_id)
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Check if user has access to delete this conversation
    if conversation.get("UserID") != user["user_id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    success = db.delete_conversation(conversation_id)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete conversation")
    
    return {"status": "success"}

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    # Check if database is connected
    if not db.conn:
        try:
            db.Conn_Sql()
        except Exception as e:
            return {"status": "error", "detail": f"Database connection failed: {str(e)}"}
    
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "version": "1.0.0"
    }

@app.get("/api/agents", response_model=List[Agent])
async def get_agents(
    department_id: Optional[int] = None,
    department_ids: Optional[List[int]] = None,
    include_global: bool = True,
    active_only: bool = True,
    user = Depends(get_current_user)
):
    """
    Get a list of AI agents.
    
    Args:
        department_id: Optional filter by department ID
        include_global: Include global agents available across departments
        active_only: Only include active agents
        
    Returns:
        List of agents matching the criteria
    """
    print(f'*******************************department_ids: {department_ids} department_ids: {department_id}')
    if department_ids is not None:
        agents_data = db.get_all_agents(
        department_id=department_ids,
        include_global=include_global,
        active_only=active_only
    )
    else:

        
        agents_data = db.get_all_agents(
            department_id=department_id,
            include_global=include_global,
            active_only=active_only
        )
    
    if not agents_data:
        return []
    
    # Convert DB dict to Pydantic model format
    agents = []
    for agent in agents_data:
        agents.append(Agent(
            agent_id=agent.get("AgentID"),
            agent_key=agent.get("AgentKey"),
            name=agent.get("Name"),
            description=agent.get("Description"),
            configuration=agent.get("Configuration"),
            is_active=bool(agent.get("IsActive")),
            department_id=agent.get("DepartmentID"),
            department_name=agent.get("DepartmentName"),
            is_global=bool(agent.get("IsGlobal")),
            created_at=agent.get("CreatedAt"),
            last_updated_at=agent.get("LastUpdatedAt"),

        ))
    
    return agents




@app.get("/api/agents/shared")
async def get_user_shared_agents(user = Depends(get_current_user)):
    """
    Get all shared agents created by a user.
    Regular users can only see their own shared agents.
    Admin users can see all shared agents.
    """
    try:
        # Get shared agents from database
        shared_agents = db.get_user_shared_agents(user_id=user["user_id"])
        
        # Format the response
        formatted_agents = []
        for agent in shared_agents:
            formatted_agents.append({
                "id": agent.get("ShareID"),
                "api_key": agent.get("ApiKey"),
                "agent_id": agent.get("AgentID"),
                "name": agent.get("Name"),
                "description": agent.get("Description") or "",
                "allowed_origins": agent.get("AllowedOrigins") or "",
                "usage_limit": agent.get("UsageLimit"),
                "usage_count": agent.get("UsageCount") or 0,
                "created_at": agent.get("CreatedAt"),
                "expires_at": agent.get("ExpiresAt")
            })
            
        return formatted_agents
        
    except Exception as e:
        logger.error(f"Error getting shared agents for user {user['user_id']}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/agents/share")
async def create_shared_agent(
    request: Request,
    user = Depends(get_current_user)
):
    """
    Create a new shared agent for external use.
    Generates an API key that can be used by external websites.
    """
    try:
        # # Check if user has permission to share agents
        # if user["role"] != "admin":
        #     has_permission = db.check_user_has_permission(
        #         user_id=user["user_id"],
        #         permission_name="share_agent"
        #     )
        #     if not has_permission:
        #         raise HTTPException(status_code=403, detail="Permission denied. User does not have 'share_agent' permission.")
        
        # Parse request body
        data = await request.json()
        agent_id = data.get("agent_id")
        name = data.get("name")
        description = data.get("description")
        allowed_origins = data.get("allowed_origins")
        usage_limit = data.get("usage_limit")
        expires_in_days = data.get("expires_at")
        
        # Handle expires_at - could be ISO date string or number of days
        expires_at = None
        if expires_in_days:
            try:
                if isinstance(expires_in_days, int) or expires_in_days.isdigit():
                    # If it's a number of days
                    expires_at = int(time.time()) + (int(expires_in_days) * 86400)
                else:
                    # If it's an ISO date string
                    expires_date = datetime.fromisoformat(expires_in_days.replace('Z', '+00:00'))
                    expires_at = int(expires_date.timestamp())
            except Exception as e:
                logger.error(f"Error parsing expires_at date: {str(e)}")
                raise HTTPException(status_code=400, detail="Invalid expires_at format. Use an ISO date string or number of days.")
        
        # Validate required fields
        if not agent_id or not name:
            raise HTTPException(status_code=400, detail="Agent ID and name are required")
            
        # Check if agent exists
        agent_data = db.get_agent(agent_id=agent_id)
        if not agent_data:
            raise HTTPException(status_code=404, detail="Agent not found")
        api_key = generate_api_key(agent_id=agent_id, user_id=user["user_id"],allowed_origins=allowed_origins,usage_limit=usage_limit,expires_at=expires_at)
        # Create shared agent in database
        shared_agent = db.create_shared_agent(
            agent_id=agent_id,
            shared_by_user_id=user["user_id"],
            name=name,
            description=description,
            allowed_origins=allowed_origins,
            usage_limit=usage_limit,
            expires_at=expires_at,
            api_key=api_key
        )
        
        if not shared_agent:
            raise HTTPException(status_code=500, detail="Failed to create shared agent")
            
        return shared_agent
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating shared agent: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/agents/share/revoke")
async def revoke_shared_agent(request: Request, user = Depends(get_current_user)):
    """
    Revoke a shared agent by setting it to inactive.
    """
    try:
        data = await request.json()
        print(data)
        api_key = data.get("api_key")
        
        if not api_key:
            raise HTTPException(status_code=400, detail="API key is required")
        
        # Get the shared agent info first to verify ownership
        cursor = db.conn.cursor()
        cursor.execute("""
            SELECT sa.ShareID, sa.AgentID, sa.SharedByUserID 
            FROM SharedAgents sa
            WHERE sa.ApiKey = ?
        """, (api_key,))
        
        shared_agent = cursor.fetchone()
        cursor.close()
        
        if not shared_agent:
            raise HTTPException(status_code=404, detail="Shared agent not found")
        
        # Verify the user owns this shared agent or is an admin
        if shared_agent.SharedByUserID != user["user_id"] and user["role"].lower() != "admin":
            raise HTTPException(status_code=403, detail="You don't have permission to revoke this shared agent")
        
        # Delete the shared agent
        success = db.delete_shared_agent(shared_agent.ShareID)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to revoke shared agent")
        
        return {"message": "Shared agent revoked successfully"}
        
    except HTTPException as e:
        logger.error(f"Error revoking shared agent: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Error revoking shared agent: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/agents/{agent_id}", response_model=Agent)
async def get_agent_by_id(
    agent_id: int,
    user = Depends(get_current_user)
):
    """
    Get details for a specific agent by ID.
    
    Args:
        agent_id: The ID of the agent to retrieve
        
    Returns:
        Agent details
    """
    agent_data = db.get_agent(agent_id=agent_id)
    
    if not agent_data:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Convert DB dict to Pydantic model format
    agent = Agent(
        agent_id=agent_data.get("AgentID"),
        agent_key=agent_data.get("AgentKey"),
        name=agent_data.get("Name"),
        description=agent_data.get("Description"),
        configuration=agent_data.get("Configuration"),
        is_active=bool(agent_data.get("IsActive")),
        department_id=agent_data.get("DepartmentID"),
        department_name=agent_data.get("DepartmentName"),
        is_global=bool(agent_data.get("IsGlobal")),
        created_at=agent_data.get("CreatedAt"),
        last_updated_at=agent_data.get("LastUpdatedAt")
    )
    
    return agent

@app.put("/api/agents/{agent_id}", response_model=Agent)
async def update_agent(
    agent_id: int,
    agent: AgentUpdate,
    user = Depends(get_current_user)
):
    """
    Update an existing AI agent.
    
    Args:
        agent_id: ID of the agent to update
        agent: Updated agent data
        
    Returns:
        Updated agent details
    """
    # # Check if user has permission to update agents
    # if user["role"] != "admin":
    #     has_permission = db.check_user_has_permission(
    #         user_id=user["user_id"],
    #         permission_name="edit_knowledge"  # Assuming this permission allows updating agents
    #     )
    #     if not has_permission:
    #         raise HTTPException(status_code=403, detail="Permission denied")
    
    # Check if agent exists
    existing_agent = db.get_agent(agent_id=agent_id)
    if not existing_agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Prepare update data
    update_data = {}
    if agent.name is not None:
        update_data["name"] = agent.name
    if agent.description is not None:
        update_data["description"] = agent.description
    if agent.configuration is not None:
        update_data["configuration"] = agent.configuration
        
        # Parse configuration and update cache if needed
        try:
            config = json.loads(agent.configuration)
            model_name = config.get("model")
            knowledge_base_id = config.get("knowledge_base_ids")
            dept_id = agent.department_id or existing_agent.get("DepartmentID")
            agent_key = agent.agent_key or existing_agent.get("AgentKey")

            print(f'///////////////////////////////// know id{knowledge_base_id}')
            print(config.get("nftext"))
            # Initialize and cache model if configuration changed
            model_instance = RAG()
            platform = db.get_platform(model_name)
            retrieval_chain = model_instance.retrieval(
                model_name=model_name,
                dept_id=str(dept_id),
                knowledge_base_id=knowledge_base_id,
                prompt=config.get("prompt", ""),
                nftext=config.get("nftext", "Sorry, no information found"),
                temperature=config.get("temperature", 0.5),
                max_tokens=config.get("max_tokens", 1024),
                platform=platform
            )
            
            if retrieval_chain != "notfound":
                print('chace model')
                await cache_model(
                    model_name=model_name,
                    dept_id=dept_id,
                    knowledge_base=knowledge_base_id,
                    agent_key=agent_key,
                    model_instance=model_instance,
                    retrieval_chain=retrieval_chain
                )
            else:
                logger.warning(f"Failed to initialize retrieval chain for agent {agent_id}")
                
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=400,
                detail="Invalid configuration JSON format"
            )
        except Exception as e:
            logger.error(f"Error updating agent cache: {str(e)}")
            # Continue with update since this is not critical
            
    if agent.is_active is not None:
        update_data["is_active"] = agent.is_active
    if agent.department_id is not None:
        update_data["department_id"] = agent.department_id
    if agent.is_global is not None:
        update_data["is_global"] = agent.is_global
    if agent.agent_key is not None:
        update_data["agent_key"] = agent.agent_key
    
    # Update the agent
    success = db.update_agent(agent_id, **update_data)
    
    if not success:
        raise HTTPException(
            status_code=400, 
            detail="Failed to update agent. Check if department exists or agent key is unique."
        )
    
    # Get the updated agent details
    agent_data = db.get_agent(agent_id=agent_id)
    
    # Convert DB dict to Pydantic model format
    return Agent(
        agent_id=agent_data.get("AgentID"),
        agent_key=agent_data.get("AgentKey"),
        name=agent_data.get("Name"),
        description=agent_data.get("Description"),
        configuration=agent_data.get("Configuration"),
        is_active=bool(agent_data.get("IsActive")),
        department_id=agent_data.get("DepartmentID"),
        department_name=agent_data.get("DepartmentName"),
        is_global=bool(agent_data.get("IsGlobal")),
        created_at=agent_data.get("CreatedAt"),
        last_updated_at=agent_data.get("LastUpdatedAt")
    )

@app.delete("/api/agents/{agent_id}")
async def delete_agent(
    agent_id: int,
    user = Depends(get_current_user)
):
    """
    Delete an AI agent.
    
    Args:
        agent_id: ID of the agent to delete
        
    Returns:
        Success message
    """
    # # Check if user has permission to delete agents
    # if user["role"] != "admin":
    #     has_permission = db.check_user_has_permission(
    #         user_id=user["user_id"],
    #         permission_name="use_agent"  # Assuming this permission allows deleting agents
    #     )
    #     if not has_permission:
    #         raise HTTPException(status_code=403, detail="Permission denied")
    
    # Check if agent exists
    existing_agent = db.get_agent(agent_id=agent_id)
    if not existing_agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Delete the agent
    success = db.delete_agent(agent_id)
    
    if not success:
        raise HTTPException(
            status_code=400, 
            detail="Failed to delete agent. It may be referenced by messages or other entities."
        )
    
    return {"status": "success", "message": f"Agent with ID {agent_id} deleted successfully"}

@app.get("/api/knowledge-bases", response_model=List[KnowledgeBase])
async def get_knowledge_bases(
    user_id: Optional[int] = None,
    department_id: Optional[int] = None,
    user = Depends(get_current_user)
):
    """
    Get a list of knowledge bases accessible by the user.
    
    Args:
        user_id: Optional filter by owner user ID
        department_id: Optional filter by department ID
        
    Returns:
        List of knowledge bases
    """
    # By default, use the current user's ID for filtering
    if user_id is None:
        user_id = user["user_id"]
    # Admin can view all knowledge bases or filter by specific user/department
    elif user["role"] != "admin" and user_id != user["user_id"]:
        # Non-admins can only view their own knowledge bases
        user_id = user["user_id"]
    
    kb_data = db.get_all_knowledge_bases(
        user_id=user_id,
        department_id=department_id
    )
    
    print(kb_data)
    if not kb_data:
        return []
    
    # Convert DB dict to Pydantic model format
    knowledge_bases = []
    for kb in kb_data:
        knowledge_bases.append(KnowledgeBase(
            knowledge_base_id=kb.get("KnowledgeBaseID"),
            name=kb.get("Name"),
            description=kb.get("Description"),
            owner_id=kb.get("OwnerID"),
            owner_name=kb.get("OwnerName"),
            department_id=kb.get("DepartmentID"),
            department_name=kb.get("DepartmentName"),
            is_public=bool(kb.get("IsPublic")),
            is_global=bool(kb.get("IsGlobal")),
            document_count=kb.get("DocumentCount", 0),
            created_at=kb.get("CreatedAt"),
            last_updated_at=kb.get("LastUpdatedAt")
        ))
    
    return knowledge_bases

@app.get("/api/knowledge-bases/{knowledge_base_id}", response_model=KnowledgeBase)
async def get_knowledge_base_by_id(
    knowledge_base_id: int,
    user = Depends(get_current_user)
):
    """
    Get details for a specific knowledge base by ID.
    
    Args:
        knowledge_base_id: The ID of the knowledge base to retrieve
        
    Returns:
        Knowledge base details
    """
    kb_data = db.get_knowledge_base(knowledge_base_id=knowledge_base_id)
    
    if not kb_data:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    # Check if user has permission to view this knowledge base
    if not kb_data.get("IsGlobal") and kb_data.get("OwnerID") != user["user_id"] and user["role"] != "admin":
        is_public = bool(kb_data.get("IsPublic"))
        # If not public, check if user belongs to the same department
        if not is_public:
            user_details = db.get_user_details(user["user_id"])
            user_depts = [dept.get("DepartmentID") for dept in user_details.get("departments", [])]
            if kb_data.get("DepartmentID") not in user_depts:
                raise HTTPException(status_code=403, detail="You do not have access to this knowledge base")
    
    # Convert DB dict to Pydantic model format
    kb = KnowledgeBase(
        knowledge_base_id=kb_data.get("KnowledgeBaseID"),
        name=kb_data.get("Name"),
        description=kb_data.get("Description"),
        owner_id=kb_data.get("OwnerID"),
        owner_name=kb_data.get("OwnerName"),
        department_id=kb_data.get("DepartmentID"),
        department_name=kb_data.get("DepartmentName"),
        is_public=bool(kb_data.get("IsPublic")),
        is_global=bool(kb_data.get("IsGlobal")),
        document_count=kb_data.get("DocumentCount", 0),
        created_at=kb_data.get("CreatedAt"),
        last_updated_at=kb_data.get("LastUpdatedAt")
    )
    
    return kb

@app.post("/api/knowledge-bases", response_model=KnowledgeBase)
async def create_knowledge_base(
    kb: KnowledgeBaseCreate,
    user = Depends(get_current_user)
):
    """
    Create a new knowledge base.
    
    Args:
        kb: Knowledge base data
        
    Returns:
        Newly created knowledge base details
    """


    print(kb)
    # # Check if user has permission to create knowledge bases
    # if user["role"] != "admin":
    #     has_permission = db.check_user_has_permission(
    #         user_id=user["user_id"],
    #         permission_name="edit_knowledge"  # Permission required to create knowledge bases
    #     )
    #     if not has_permission:
    #         raise HTTPException(status_code=403, detail="Permission denied")
    
    # Create the knowledge base
    kb_id = db.create_knowledge_base(
        name=kb.name,
        description=kb.description,
        owner_id=user["user_id"],  # Current user is the owner
        department_id=kb.department_id,
        is_public=kb.is_public,
        is_global=kb.is_global
    )
    
    if not kb_id:
        raise HTTPException(
            status_code=400, 
            detail="Failed to create knowledge base. Check if department exists."
        )
    
    # Get the created knowledge base details
    kb_data = db.get_knowledge_base(knowledge_base_id=kb_id)
    
    # Convert DB dict to Pydantic model format
    return KnowledgeBase(
        knowledge_base_id=kb_data.get("KnowledgeBaseID"),
        name=kb_data.get("Name"),
        description=kb_data.get("Description"),
        owner_id=kb_data.get("OwnerID"),
        owner_name=kb_data.get("OwnerName"),
        department_id=kb_data.get("DepartmentID"),
        department_name=kb_data.get("DepartmentName"),
        is_public=bool(kb_data.get("IsPublic")),
        is_global=bool(kb_data.get("IsGlobal")),
        document_count=kb_data.get("DocumentCount", 0),
        created_at=kb_data.get("CreatedAt"),
        last_updated_at=kb_data.get("LastUpdatedAt")
    )

@app.put("/api/knowledge-bases/{knowledge_base_id}", response_model=KnowledgeBase)
async def update_knowledge_base(
    knowledge_base_id: int,
    kb: KnowledgeBaseUpdate,
    user = Depends(get_current_user)
):
    """
    Update an existing knowledge base.
    
    Args:
        knowledge_base_id: ID of the knowledge base to update
        kb: Updated knowledge base data
        
    Returns:
        Updated knowledge base details
    """
    # Get existing knowledge base to check permissions
    existing_kb = db.get_knowledge_base(knowledge_base_id=knowledge_base_id)
    if not existing_kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    # # Check if user has permission to update this knowledge base
    # if user["role"] != "admin" and existing_kb.get("OwnerID") != user["user_id"]:
    #     has_permission = db.check_user_has_permission(
    #         user_id=user["user_id"],
    #         permission_name="edit_knowledge"  # Permission required to update knowledge bases
    #     )
       #     if not has_permission:
    #         raise HTTPException(status_code=403, detail="Permission denied")
    
    # Prepare update data
    update_data = {}
    if kb.name is not None:
        update_data["name"] = kb.name
    if kb.description is not None:
        update_data["description"] = kb.description
    if kb.department_id is not None:
        update_data["department_id"] = kb.department_id
    if kb.is_public is not None:
        update_data["is_public"] = kb.is_public
    if kb.is_global is not None:
        update_data["is_global"] = kb.is_global
    
    # Update the knowledge base
    success = db.update_knowledge_base(knowledge_base_id, **update_data)
    
    if not success:
        raise HTTPException(
            status_code=400, 
            detail="Failed to update knowledge base. Check if department exists."
        )
    
    # Get the updated knowledge base details
    kb_data = db.get_knowledge_base(knowledge_base_id=knowledge_base_id)
    
    # Convert DB dict to Pydantic model format
    return KnowledgeBase(
        knowledge_base_id=kb_data.get("KnowledgeBaseID"),
        name=kb_data.get("Name"),
        description=kb_data.get("Description"),
        owner_id=kb_data.get("OwnerID"),
        owner_name=kb_data.get("OwnerName"),
        department_id=kb_data.get("DepartmentID"),
        department_name=kb_data.get("DepartmentName"),
        is_public=bool(kb_data.get("IsPublic")),
        is_global=bool(kb_data.get("IsGlobal")),
        document_count=kb_data.get("DocumentCount", 0),
        created_at=kb_data.get("CreatedAt"),
        last_updated_at=kb_data.get("LastUpdatedAt")
    )

@app.delete("/api/knowledge-bases/{knowledge_base_id}")
async def delete_knowledge_base(
    knowledge_base_id: int,
    user = Depends(get_current_user)
):
    """
    Delete a knowledge base and its associated embeddings.
    
    Args:
        knowledge_base_id: ID of the knowledge base to delete
        
    Returns:
        Success message
    """
    # Get existing knowledge base to check permissions
    existing_kb = db.get_knowledge_base(knowledge_base_id=knowledge_base_id)
    if not existing_kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    # # Check if user has permission to delete this knowledge base
    # if user["role"] != "admin" and existing_kb.get("OwnerID") != user["user_id"]:
    #     has_permission = db.check_user_has_permission(
    #         user_id=user["user_id"],
    #         permission_name="edit_knowledge"
    #     )
    #     if not has_permission:
    #         raise HTTPException(status_code=403, detail="Permission denied")
    
    # Delete the knowledge base from database
    success = db.delete_knowledge_base(knowledge_base_id)
    
    if not success:
        raise HTTPException(
            status_code=400, 
            detail="Failed to delete knowledge base. It may be referenced by agents."
        )
    
    # Delete associated embeddings collection
    try:
        model = RAG()
        dept_id = str(existing_kb.get("DepartmentID", ""))
        result = await model.delete_collection(
            dept_id=dept_id,
            knowledge_base_id=str(knowledge_base_id)
        )
        if result == "success":
            logger.info(f"Successfully deleted embeddings collection for knowledge base {knowledge_base_id}")
        else:
            logger.warning(f"Could not delete embeddings collection for knowledge base {knowledge_base_id}")
    except Exception as e:
        logger.error(f"Error deleting embeddings collection: {str(e)}")
        # Continue since database record is already deleted

    # Update cache for all agents that use this knowledge base
    try:
        # Check for any agents using this knowledge base
        agents = db.get_all_agents(active_only=True)
        kb_str = str(knowledge_base_id)
        
        for agent in agents:
            try:
                config = json.loads(agent.get("Configuration", "{}"))
                model_name = config.get("model")
                kb_ids = config.get("knowledge_base_ids")
                
                # Skip if agent doesn't use the deleted knowledge base
                if not kb_ids or kb_str not in str(kb_ids):
                    continue
                    
                agent_dept_id = agent.get("DepartmentID", 1)
                agent_key = agent.get("AgentKey")
                
                # Create new model and retrieval chain
                logger.info(f"Updating cache for agent {agent_key} after knowledge base deletion")
                model_instance = RAG()
                platform = db.get_platform(model_name)
                retrieval_chain = model_instance.retrieval(
                    model_name=model_name,
                    dept_id=str(agent_dept_id),
                    knowledge_base_id=[kb_id for kb_id in kb_ids if kb_id != kb_str],
                    prompt=config.get("prompt", ""),
                    nftext=config.get("nftext", "Sorry, no information found"),
                    temperature=config.get("temperature", 0.5),
                    max_tokens=config.get("max_tokens", 1024),
                    platform=platform
                )
                
                if retrieval_chain != "notfound":
                    # Cache both model and retrieval chain
                    await cache_model(
                        model_name=model_name,
                        dept_id=agent_dept_id,
                        knowledge_base=[kb_id for kb_id in kb_ids if kb_id != kb_str],
                        agent_key=agent_key,
                        model_instance=model_instance,
                        retrieval_chain=retrieval_chain
                    )
                    logger.info(f"Successfully cached model and retrieval chain for agent {agent_key}")
                else:
                    logger.warning(f"Could not update retrieval chain for agent {agent_key}")
            except Exception as e:
                logger.error(f"Error updating cache for agent {agent.get('AgentKey')}: {str(e)}")
    except Exception as e:
        logger.error(f"Error updating model cache after knowledge base deletion: {str(e)}")
        # Continue since the knowledge base was already deleted successfully
        
    return {"status": "success", "message": f"Knowledge base with ID {knowledge_base_id} deleted successfully"}

@app.get("/api/documents/{document_id}", response_model=Document)
async def get_document_by_id(
    document_id: int,
    user = Depends(get_current_user)
):
    """
    Get details for a specific document by ID.
    
    Args:
        document_id: The ID of the document to retrieve
        
    Returns:
        Document details
    """
    document_data = db.get_document(document_id=document_id)
    
    if not document_data:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Get knowledge base to check permissions
    kb_id = document_data.get("KnowledgeBaseID")
    kb_data = db.get_knowledge_base(knowledge_base_id=kb_id)
    
    # Check if user has permission to view this document
    if not kb_data.get("IsGlobal") and kb_data.get("OwnerID") != user["user_id"] and user["role"] != "admin":
        is_public = bool(kb_data.get("IsPublic"))
        # If not public, check if user belongs to the same department
        if not is_public:
            user_details = db.get_user_details(user["user_id"])
            user_depts = [dept.get("DepartmentID") for dept in user_details.get("departments", [])]
            if kb_data.get("DepartmentID") not in user_depts:
                raise HTTPException(status_code=403, detail="You do not have access to this document")
    
    # Convert DB dict to Pydantic model format
    document = Document(
        document_id=document_data.get("DocumentID"),
        knowledge_base_id=document_data.get("KnowledgeBaseID"),
        title=document_data.get("Title"),
        content=document_data.get("Content"),
        file_url=document_data.get("FileURL"),
        file_type=document_data.get("FileType"),
        is_processed=bool(document_data.get("IsProcessed")),
        created_at=document_data.get("CreatedAt"),
        last_updated_at=document_data.get("LastUpdatedAt")
    )
    
    return document

@app.get("/api/knowledge-bases/{knowledge_base_id}/documents", response_model=List[Document])
async def get_documents_in_knowledge_base(
    knowledge_base_id: int,
    user = Depends(get_current_user)
):
    """
    Get all documents in a knowledge base.
    
    Args:
        knowledge_base_id: The ID of the knowledge base to retrieve documents from
        
    Returns:
        List of documents in the knowledge base
    """
    # Check if knowledge base exists and user has access to it
    kb_data = db.get_knowledge_base(knowledge_base_id=knowledge_base_id)
    
    if not kb_data:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    # Check if user has permission to view this knowledge base
    if not kb_data.get("IsGlobal") and kb_data.get("OwnerID") != user["user_id"] and user["role"] != "admin":
        is_public = bool(kb_data.get("IsPublic"))
        # If not public, check if user belongs to the same department
        if not is_public:
            user_details = db.get_user_details(user["user_id"])
            user_depts = [dept.get("DepartmentID") for dept in user_details.get("departments", [])]
            if kb_data.get("DepartmentID") not in user_depts:
                raise HTTPException(status_code=403, detail="You do not have access to this knowledge base")
    
    # Get documents from the knowledge base
    documents_data = db.get_documents_in_knowledge_base(knowledge_base_id)
    
    if not documents_data:
        return []
    
    # Convert DB dict to Pydantic model format
    documents = []
    for doc in documents_data:
        documents.append(Document(
            document_id=doc.get("DocumentID"),
            knowledge_base_id=doc.get("KnowledgeBaseID"),
            title=doc.get("Title"),
            content=doc.get("Content"),
            file_url=doc.get("FileURL"),
            file_type=doc.get("FileType"),
            is_processed=bool(doc.get("IsProcessed")),
            created_at=doc.get("CreatedAt"),
            last_updated_at=doc.get("LastUpdatedAt")
        ))
    
    return documents

@app.post("/api/documents", response_model=Document)
async def create_document(
    document: str = Form(...),
    file: Optional[UploadFile] = File(None),
    user = Depends(get_current_user)
):
    
    print(document)
    """Create a new document in a knowledge base from either a file upload or web URL."""
    try:
        # Parse the document JSON data
        document_data = json.loads(document)
        web_title = ""
        # Check for web URL and handle title extraction
        if document_data.get("file_url") and validators.url(document_data.get("file_url")):
            try:
                response = requests.get(document_data.get("file_url"))
                soup = BeautifulSoup(response.text, 'html.parser')
                # Try to get title from webpage first, fallback to document data title
                web_title = soup.title.string.strip() if soup.title else document_data.get("title", "Untitled Document")
            except Exception as e:
                logger.warning(f"Failed to extract title from web page: {str(e)}")
        
        # Convert to Pydantic model for validation
        document_create = DocumentCreate(
            knowledge_base_id=document_data.get("knowledge_base_id"),
            title=web_title,
            file_url=document_data.get("file_url"),
            file_type=document_data.get("file_type")
        )
        
        # Get knowledge base and check permissions
        kb_data = db.get_knowledge_base(knowledge_base_id=document_create.knowledge_base_id)
       
        if not kb_data:
            raise HTTPException(status_code=404, detail="Knowledge base not found")

        # # Check permissions
        # if user["role"] != "admin" and kb_data.get("OwnerID") != user["user_id"]:
        #     has_permission = db.check_user_has_permission(
        #         user_id=user["user_id"],
        #         permission_name="edit_knowledge"
        #     )
        #     if not has_permission:
        #         raise HTTPException(status_code=403, detail="Permission denied")

        docs = []
        file_path = None
        web_url = None
        document_id = None

        # Step 1: Create document record with only file URL/title and IsProcessed=0
        if document_create.file_url and validators.url(document_create.file_url):
            # Handle web URL
            web_url = document_create.file_url
            
            # If no title provided, try to extract from web page
            if not document_create.title:
                try:
                    from bs4 import BeautifulSoup

                    response = requests.get(web_url)
                    soup = BeautifulSoup(response.text, 'html.parser')
                    document_create.title = soup.title.string if soup.title else "Web Page"
                except Exception as e:
                    document_create.title = "Web Page"
                    
            # Create initial document record with URL only
            document_id = db.add_document_to_knowledge_base(
                knowledge_base_id=document_create.knowledge_base_id,
                title=document_create.title or "Untitled Document",
                content=None,  # No content yet
                file_url=web_url,
                file_type="web_content"
            )
                
        elif file:
            # Save file temporarily
            file_content = await file.read()
            file_name = file.filename
            file_ext = os.path.splitext(file_name)[1].lower()
            
            # Create temporary directory if it doesn't exist
            temp_dir = os.path.join("uploaded_files", f"kb_{document_create.knowledge_base_id}").replace('\\', '/')
            os.makedirs(temp_dir, exist_ok=True)
            
            # Save file with forward slashes
            file_path = os.path.join(temp_dir, file_name).replace('\\', '/')
            with open(file_path, "wb") as f:
                f.write(file_content)
            
            document_create.file_url = file_path
            document_create.title = file_name

            # Create initial document record with file path only
            document_id = db.add_document_to_knowledge_base(
                knowledge_base_id=document_create.knowledge_base_id,
                title=document_create.title or "Untitled Document",
                content=None,  # No content yet
                file_url=file_path,
                file_type=file.content_type
            )

        if not document_id:
            raise HTTPException(status_code=500, detail="Failed to create initial document record")

        # Step 2: Process the document and extract content
        if web_url:
            # Use crawl function to get web content
            docs = await crawl(web_url)
        elif file_path:
            # Load document based on file type
            if file_ext in ['.pdf']:
                loader = PyPDFLoader(file_path)
                docs = loader.load()
            elif file_ext in ['.csv']:
                loader = CSVLoader(file_path)
                docs = loader.load()
            elif file_ext in ['.txt', '.md', '.html', '.htm']:
                loader = TextLoader(file_path, encoding='utf-8')
                docs = loader.load()
            elif file_ext in ['.docx', '.doc']:
                loader = Docx2txtLoader(file_path)
                docs = loader.load()
            else:
                # For unsupported files, treat as text
                try:
                    loader = TextLoader(file_path, encoding='utf-8')
                    docs = loader.load()
                except Exception as e:
                    # Update document to indicate processing failed
                    db.update_document(
                        document_id=document_id,
                        is_processed=False,  # Mark as processed even though it failed
                        content="Error: Unsupported file type"
                    )
                    raise HTTPException(status_code=400, detail=f"Unsupported file type: {file_ext}")

        # Get or initialize model for embeddings
        dept_id = kb_data.get("DepartmentID")
        kb_id = document_create.knowledge_base_id
        print(f'Department ID: {dept_id}, Knowledge Base ID: {kb_id}')
        
        # Update document metadata
        for doc in docs:
            doc.metadata.update({
                "source": web_url or file_path,
                "knowledge_base_id": kb_id,
                "department_id": dept_id,
                "uploaded_by": user["user_id"]
            })

        # Create or update embeddings
        async with embedding_lock:
            model = RAG()
            # First check if embeddings exist
            embeddings_exist = await model.check_embedding(
                dept_id=str(dept_id),
                knowledge_base_id=str(kb_id)
            )
            
            if embeddings_exist:
                # Update existing embeddings
                result = await model.append_embeddings(
                    dept_id=str(dept_id),
                    docs=docs,
                    knowledge_base_id=str(kb_id)
                )
            else:
                # Create new embeddings
                print("Creating new embeddings")
                result = await model.embeddings(
                    dept_id=str(dept_id),
                    docs=docs,
                    knowledge_base_id=str(kb_id)
                )
                print("Embeddings created")

        if result == "notfound":
            # Update document to indicate processing failed
            db.update_document(
                document_id=document_id,
                is_processed=False,  # Mark as processed even though it failed
                content="Error: Failed to create/update embeddings"
            )
            raise HTTPException(status_code=500, detail="Failed to create/update embeddings")

        # Join document contents
        contents = "".join(doc.page_content for doc in docs)
        
        # Step 3: Update document record with content and set IsProcessed=1
        success = db.update_document(
            document_id=document_id,
            content=contents,
            is_processed=False  # Mark as processed successfully
        )
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update document content")

        # Get the updated document details
        document_data = db.get_document(document_id=document_id)
        
        # Map database column names to Pydantic model field names
        mapped_data = {
            "document_id": document_data.get("DocumentID"),
            "knowledge_base_id": document_data.get("KnowledgeBaseID"),
            "title": document_data.get("Title"),
            "content": document_data.get("Content"),
            "file_url": document_data.get("FileURL"),
            "file_type": document_data.get("FileType"),
            "is_processed": bool(document_data.get("IsProcessed")),
            "created_at": document_data.get("CreatedAt"),
            "last_updated_at": document_data.get("LastUpdatedAt")
        }

        # Update cache for all agents that use this knowledge base
        try:
            # Check for any agents using this knowledge base
            agents = db.get_all_agents(active_only=True)
            kb_str = str(kb_id)
            
            for agent in agents:
                try:
                    config = json.loads(agent.get("Configuration", "{}"))
                    model_name = config.get("model")
                    kb_ids = config.get("knowledge_base_ids")
                    
                    # Skip if agent doesn't use the modified knowledge base
                    if not kb_ids or kb_str not in str(kb_ids):
                        continue
                        
                    agent_dept_id = agent.get("DepartmentID", 1)
                    agent_key = agent.get("AgentKey")
                    
                    # Create new model and retrieval chain
                    logger.info(f"Updating cache for agent {agent_key} after document creation")
                    model_instance = RAG()
                    platform = db.get_platform(model_name)
                    retrieval_chain = model_instance.retrieval(
                        model_name=model_name,
                        dept_id=str(agent_dept_id),
                        knowledge_base_id=kb_ids,
                        prompt=config.get("prompt", ""),
                        nftext=config.get("nftext", "Sorry, no information found"),
                        temperature=config.get("temperature", 0.5),
                        max_tokens=config.get("max_tokens", 1024),
                        platform=platform
                    )
                    
                    if retrieval_chain != "notfound":
                        # Update cache
                        await cache_model(
                            model_name=model_name,
                            dept_id=agent_dept_id,
                            knowledge_base=kb_ids,
                            agent_key=agent_key,
                            model_instance=model_instance,
                            retrieval_chain=retrieval_chain
                        )
                        logger.info(f"Successfully updated cache for agent {agent_key}")
                    else:
                        logger.warning(f"Could not update retrieval chain for agent {agent_key}")
                except Exception as e:
                    logger.error(f"Error updating cache for agent {agent.get('AgentKey')}: {str(e)}")
        except Exception as e:
            logger.error(f"Error updating model cache after document creation: {str(e)}")
            # Continue since the document was already created successfully
        
        return Document(**mapped_data)

    except Exception as e:
        logger.error(f"Error creating document: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/documents/{document_id}", response_model=Document)
async def update_document(
    document_id: int,
    document: DocumentUpdate,
    file: Optional[UploadFile] = File(None),
    user = Depends(get_current_user)
):
    """Update a document with optional file replacement."""
    try:
        # Get existing document to check permissions
        existing_doc = db.get_document(document_id=document_id)
        if not existing_doc:
            raise HTTPException(status_code=404, detail="Document not found")

        kb_data = db.get_knowledge_base(knowledge_base_id=existing_doc["KnowledgeBaseID"])
        
        # # Check permissions
        # if user["role"] != "admin" and kb_data.get("OwnerID") != user["user_id"]:
        #     has_permission = db.check_user_has_permission(
        #         user_id=user["user_id"],
        #         permission_name="edit_knowledge"  # Permission required to update documents
        #     )
        #     if not has_permission:
        #         raise HTTPException(status_code=403, detail="Permission denied")

        # Initialize RAG model for embedding operations
        model = RAG()
        dept_id = str(kb_data.get("DepartmentID", ""))
        knowledge_base_id = str(existing_doc["KnowledgeBaseID"])
        
        # If there's a file, handle file update
        if file:
            # Delete old embeddings first
            old_file_url = existing_doc.get("FileURL")
            if old_file_url:
                try:
                    logger.info(f"Deleting old embeddings for file: {old_file_url}")
                    result = await model.delete_embedding(
                        dept_id=dept_id,
                        knowledge_base_id=knowledge_base_id,
                        source_path=old_file_url,
                        dry_run=False
                    )
                    if result != "success":
                        logger.warning(f"Could not delete old embeddings for file: {old_file_url}")
                except Exception as e:
                    logger.error(f"Error deleting old embeddings: {str(e)}")

            # Process new file
            upload_dir = f"uploaded_files/kb_{existing_doc['KnowledgeBaseID']}"
            os.makedirs(upload_dir, exist_ok=True)
            file_path = os.path.join(upload_dir, file.filename).replace('\\', '/')
            
            with open(file_path, "wb") as f:
                content = await file.read()
                f.write(content)

            # Load and process new document
            file_ext = file.filename.lower().split('.')[-1]
            if file_ext == 'pdf':
                loader = PyPDFLoader(file_path)
            elif file_ext == 'csv':
                loader = CSVLoader(file_path)
            elif file_ext in ['txt', 'md', 'html', 'htm']:
                loader = TextLoader(file_path, encoding='utf-8')
            elif file_ext in ['docx', 'doc']:
                loader = Docx2txtLoader(file_path)
            else:
                loader = TextLoader(file_path, encoding='utf-8')

            docs = loader.load()
            
            # Update metadata
            for doc in docs:
                doc.metadata.update({
                    "source": file_path,
                    "knowledge_base_id": existing_doc["KnowledgeBaseID"],
                    "department_id": kb_data.get("DepartmentID"),
                    "uploaded_by": user["user_id"]
                })

            # Create new embeddings
            async with embedding_lock:
                embeddings_exist =await model.check_embedding(
                    dept_id=dept_id,
                    knowledge_base_id=knowledge_base_id
                )
                
                if embeddings_exist:
                    result =await model.append_embeddings(
                        dept_id=dept_id,
                        docs=docs,
                        knowledge_base_id=knowledge_base_id
                    )
                else:
                    result =await model.embeddings(
                        dept_id=dept_id,
                        docs=docs,
                        knowledge_base_id=knowledge_base_id
                    )
                
                if result == "notfound" or result == "error":
                    raise HTTPException(status_code=500, detail="Failed to update embeddings")

            # Update document record
            update_data = document.dict(exclude_unset=True)
            update_data["file_url"] = file_path
            update_data["file_type"] = file.content_type

        else:
            # Handle metadata-only updates
            update_data = document.dict(exclude_unset=True)

        success = db.update_document(document_id, **update_data)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to update document")

        # Get updated document details
        updated_doc = db.get_document(document_id=document_id)
        return Document(**updated_doc)

    except Exception as e:
        logger.error(f"Error updating document: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/documents/{document_id}")
async def delete_document(
    document_id: int,
    user = Depends(get_current_user)
):
    """
    Delete a document from a knowledge base.
    
    Args:
        document_id: ID of the document to delete
        
    Returns:
        Success message
    """
    # Get existing document to check knowledge base and permissions
    existing_doc = db.get_document(document_id=document_id)
    if not existing_doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    knowledge_base_id = existing_doc.get("KnowledgeBaseID")
    file_url = existing_doc.get("FileURL")  # Get the file URL for embedding deletion
    
    # Get knowledge base to check permissions
    kb_data = db.get_knowledge_base(knowledge_base_id=knowledge_base_id)
    if not kb_data:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    # # Check if user has permission to delete documents in this knowledge base
    # if user["role"] != "admin" and kb_data.get("OwnerID") != user["user_id"]:
    #     has_permission = db.check_user_has_permission(
    #         user_id=user["user_id"],
    #         permission_name="edit_knowledge"  # Permission required to delete documents
    #     )
    #     if not has_permission:
    #         raise HTTPException(status_code=403, detail="Permission denied")
    
    # Delete from database first
    success = db.delete_document(document_id)
    
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Failed to delete document"
        )
    
    # Delete from embeddings if file_url exists
    if file_url:
        try:
            logger.info(f"Attempting to delete embeddings for file: {file_url}")
            model = RAG()
            dept_id = str(kb_data.get("DepartmentID", ""))
            result = await model.delete_embedding(
                dept_id=dept_id,
                knowledge_base_id=str(knowledge_base_id),
                source_path=file_url,
                dry_run=False
            )
            # Delete the file from the local system
            if os.path.exists(file_url):
                try:
                    os.remove(file_url)
                    logger.info(f"Successfully deleted file: {file_url}")
                except Exception as e:
                    logger.error(f"Error deleting file: {file_url}. Error: {str(e)}")
            if result == "success":
                logger.info(f"Successfully deleted embeddings for file: {file_url}")
            else:
                logger.warning(f"Could not delete embeddings for file: {file_url}")
        except Exception as e:
            logger.error(f"Error deleting embeddings: {str(e)}")
            # Don't raise error since document was already deleted from DB
    
    # Update cache for all agents that use this knowledge base
    try:
        # Check for any agents using this knowledge base
        agents = db.get_all_agents(active_only=True)
        kb_str = str(knowledge_base_id)
        
        for agent in agents:
            try:
                config = json.loads(agent.get("Configuration", "{}"))
                model_name = config.get("model")
                kb_ids = config.get("knowledge_base_ids")
                
                # Skip if agent doesn't use the modified knowledge base
                if not kb_ids or kb_str not in str(kb_ids):
                    continue
                    
                agent_dept_id = agent.get("DepartmentID", 1)
                agent_key = agent.get("AgentKey")
                
                # Create new model and retrieval chain
                logger.info(f"Updating cache for agent {agent_key} after document deletion")
                model_instance = RAG()
                platform = db.get_platform(model_name)
                retrieval_chain = model_instance.retrieval(
                    model_name=model_name,
                    dept_id=str(agent_dept_id),
                    knowledge_base_id=kb_ids,
                    prompt=config.get("prompt", ""),
                    nftext=config.get("nftext", "Sorry, no information found"),
                    temperature=config.get("temperature", 0.5),
                    max_tokens=config.get("max_tokens", 1024),
                    platform=platform
                )
                
                if retrieval_chain != "notfound":
                    # Update cache
                    await cache_model(
                        model_name=model_name,
                        dept_id=agent_dept_id,
                        knowledge_base=kb_ids,
                        agent_key=agent_key,
                        model_instance=model_instance,
                        retrieval_chain=retrieval_chain
                    )
                    logger.info(f"Successfully updated cache for agent {agent_key}")
                else:
                    logger.warning(f"Could not update retrieval chain for agent {agent_key}")
            except Exception as e:
                logger.error(f"Error updating cache for agent {agent.get('AgentKey')}: {str(e)}")
    except Exception as e:
        logger.error(f"Error updating model cache after document deletion: {str(e)}")
        # Continue since the document was already deleted successfully
            
    return {"status": "success", "message": f"Document with ID {document_id} deleted successfully"}

@app.get("/api/departments", response_model=List[Department])
async def get_departments(user = Depends(get_current_user)):
    """
    Get a list of all departments.
    
    Returns:
        List of all departments
    """
    logger.info(f"User {user['username']} is fetching all departments")
    departments_data = db.get_all_departments()
    print(f'kb_count: {departments_data}')
    if not departments_data:
        return []
    
    # Convert DB dict to Pydantic model format
    departments = []
    for dept in departments_data:
        departments.append(Department(
            department_id=dept.get("DepartmentID"),
            name=dept.get("Name"),
            description=dept.get("Description"),
            user_count=dept.get("UserCount", 0),
            knowledgebase_count=dept.get("KnowledgeBaseCount"),
            created_at=dept.get("CreatedAt"),
            last_updated_at=dept.get("LastUpdatedAt")
        ))

    print(f'departments: {departments}')
    
    return departments

@app.get("/api/departments/{department_id}", response_model=Department)
async def get_department_by_id(
    department_id: int,
    user = Depends(get_current_user)
):
    """
    Get details for a specific department by ID.
    
    Args:
        department_id: The ID of the department to retrieve
        
    Returns:
        Department details
    """
    department_data = db.get_department(department_id=department_id)
    
    if not department_data:
        raise HTTPException(status_code=404, detail="Department not found")
    
    # Convert DB dict to Pydantic model format
    department = Department(
        department_id=department_data.get("DepartmentID"),
        name=department_data.get("Name"),
        description=department_data.get("Description"),
        user_count=department_data.get("UserCount", 0),
        created_at=department_data.get("CreatedAt"),
        last_updated_at=department_data.get("LastUpdatedAt")
    )
    
    return department

@app.post("/api/departments", response_model=Department)
async def create_department(
    department: DepartmentCreate,
    user = Depends(get_current_user)
):
    """
    Create a new department.
    
    Args:
        department: Department data
        
    Returns:
        Newly created department details
    """
    # # Check if user has permission to create departments
    # if user["role"] != "admin":
    #     has_permission = db.check_user_has_permission(
    #         user_id=user["user_id"],
    #         permission_name="manage_departments"
    #     )
    #     if not has_permission:
    #         raise HTTPException(status_code=403, detail="Permission denied")
    
    # Create the department
    department_id = db.create_department(
        name=department.name,
        description=department.description
    )
    
    if not department_id:
        raise HTTPException(
            status_code=400, 
            detail="Failed to create department"
        )
    
    # Get the created department details
    department_data = db.get_department(department_id=department_id)
    
    # Convert DB dict to Pydantic model format
    return Department(
        department_id=department_data.get("DepartmentID"),
        name=department_data.get("Name"),
        description=department_data.get("Description"),
        user_count=department_data.get("UserCount", 0),
        created_at=department_data.get("CreatedAt"),
        last_updated_at=department_data.get("LastUpdatedAt")
    )

@app.put("/api/departments/{department_id}", response_model=Department)
async def update_department(
    department_id: int,
    department: DepartmentUpdate,
    user = Depends(get_current_user)
):
    """
    Update an existing department.
    
    Args:
        department_id: ID of the department to update
        department: Updated department data
        
    Returns:
        Updated department details
    """
    # # Check if user has permission to update departments
    # if user["role"] != "admin":
    #     has_permission = db.check_user_has_permission(
    #         user_id=user["user_id"],
    #         permission_name="manage_departments"
    #     )
    #     if not has_permission:
    #         raise HTTPException(status_code=403, detail="Permission denied")
    
    # Check if department exists
    existing_department = db.get_department(department_id=department_id)
    if not existing_department:
        raise HTTPException(status_code=404, detail="Department not found")
    
    # Prepare update data
    update_data = {}
    if department.name is not None:
        update_data["name"] = department.name
    if department.description is not None:
        update_data["description"] = department.description
    
    # Update the department
    success = db.update_department(department_id, **update_data)
    
    if not success:
        raise HTTPException(
            status_code=400, 
            detail="Failed to update department"
        )
    
    # Get the updated department details
    department_data = db.get_department(department_id=department_id)
    
    # Convert DB dict to Pydantic model format
    return Department(
        department_id=department_data.get("DepartmentID"),
        name=department_data.get("Name"),
        description=department_data.get("Description"),
        user_count=department_data.get("UserCount", 0),
        created_at=department_data.get("CreatedAt"),
        last_updated_at=department_data.get("LastUpdatedAt")
    )

@app.delete("/api/departments/{department_id}")
async def delete_department(
    department_id: int,
    user = Depends(get_current_user)
):
    """
    Delete a department.
    
    Args:
        department_id: ID of the department to delete
        
    Returns:
        Success message
    """
    # # Check if user has permission to delete departments
    # if user["role"] != "admin":
    #     has_permission = db.check_user_has_permission(
    #         user_id=user["user_id"],
    #         permission_name="manage_departments"
    #     )
    #     if not has_permission:
    #         raise HTTPException(status_code=403, detail="Permission denied")
    
    # Check if department exists
    existing_department = db.get_department(department_id=department_id)
    if not existing_department:
        raise HTTPException(status_code=404, detail="Department not found")
    
    # Delete the department
    success = db.delete_department(department_id)
    
    if not success:
        raise HTTPException(
            status_code=400, 
            detail="Failed to delete department. It may be referenced by users, agents, or knowledge bases."
        )
    
    return {"status": "success", "message": f"Department with ID {department_id} deleted successfully"}

@app.get("/api/departments/{department_id}/users")
async def get_department_users(
    department_id: int,
    user = Depends(get_current_user)
):
    """
    Get all users in a department.
    
    Args:
        department_id: The ID of the department
        
    Returns:
        List of users in the department
    """
    # Check if department exists
    existing_department = db.get_department(department_id=department_id)
    if not existing_department:
        raise HTTPException(status_code=404, detail="Department not found")
    
    # # Check if user has permission to view department users
    # if user["role"] != "admin":
    #     user_details = db.get_user_details(user["user_id"])
    #     user_depts = [dept.get("DepartmentID") for dept in user_details.get("departments", [])]
    #     if department_id not in user_depts:
    #         has_permission = db.check_user_has_permission(
    #             user_id=user["user_id"],
    #             permission_name="view_department_users"
    #         )
    #         if not has_permission:
    #             raise HTTPException(status_code=403, detail="Permission denied")
    
    # Get users in the department
    users_data = db.get_department_users(department_id)
    
    # Clean user data for response
    users = []
    for user_data in users_data:
        if user_data:
            # Remove sensitive information
            if "PasswordHash" in user_data:
                del user_data["PasswordHash"]
            users.append(user_data)
    
    return {"users": users}

@app.post("/api/departments/{department_id}/users/{user_id}")
async def add_user_to_department(
    department_id: int,
    user_id: int,
    current_user = Depends(get_current_user)
):
    """
    Add a user to a department.
    
    Args:
        department_id: The ID of the department
        user_id: The ID of the user to add
        
    Returns:
        Success message
    """
    # # Check if user has permission to manage department users
    # if current_user["role"] != "admin":
    #     has_permission = db.check_user_has_permission(
    #         user_id=current_user["user_id"],
    #         permission_name="manage_department_users"
    #     )
    #     if not has_permission:
    #         raise HTTPException(status_code=403, detail="Permission denied")
    
    # Check if department exists
    existing_department = db.get_department(department_id=department_id)
    if not existing_department:
        raise HTTPException(status_code=404, detail="Department not found")
    
    # Check if user exists
    user_data = db.get_user_details(user_id)
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Add user to department
    success = db.add_user_to_department(
        user_id=user_id,
        department_id=department_id
    )
    
    if not success:
        raise HTTPException(
            status_code=404,
            detail="Failed to add user to department"
        )

    return {"status": "success", "message": f"User with ID {user_id} added to department with ID {department_id}"}

@app.delete("/api/departments/{department_id}/users/{user_id}")
async def remove_user_from_department(
    department_id: int,
    user_id: int,
    current_user = Depends(get_current_user)
):
    """
    Remove a user from a department.
    
    Args:
        department_id: The ID of the department
        user_id: The ID of the user to remove
        
    Returns:
        Success message
    """
    # # Check if user has permission to manage department users
    # if current_user["role"] != "admin":
    #     has_permission = db.check_user_has_permission(
    #         user_id=current_user["user_id"],
    #         permission_name="manage_department_users"
    #     )
    #     if not has_permission:
    #         raise HTTPException(status_code=403, detail="Permission denied")
    
    # Check if department exists
    existing_department = db.get_department(department_id=department_id)
    if not existing_department:
        raise HTTPException(status_code=404, detail="Department not found")
    
    # Check if user exists
    user_data = db.get_user_details(user_id)
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Remove user from department
    success = db.remove_user_from_department(user_id, department_id)
    
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Failed to remove user from department"
        )
    
    return {"status": "success", "message": f"User with ID {user_id} removed from department with ID {department_id}"}

@app.get("/api/permissions", response_model=List[Permission])
async def get_all_permissions(
    user = Depends(get_current_user)
):
    """
    Get all available permissions in the system.
    
    Returns:
        List of all permissions
    """
    # Only admins can see all permissions
    if user["role"] != "admin" and user["role"] != "full-admin":
        raise HTTPException(status_code=403, detail="Only admin users can access all permissions")
    
    permissions_data = db.get_all_permissions()
    
    if not permissions_data:
        return []
    
    # Convert DB dict to Pydantic model format
    permissions = []
    for perm in permissions_data:
        permissions.append(Permission(
            permission_id=perm.get("PermissionID"),
            permission_name=perm.get("PermissionName"),
            description=perm.get("Description")
        ))
    
    return permissions

@app.post("/api/permissions/user")
async def add_permission_to_user(
    request: PermissionRequest,
    user = Depends(get_current_user)
):
    """
    Add a permission to a user.
    
    Args:
        request: Contains permission_name and optional user_id
        
    Returns:
        Success message
    """
    # Determine the target user ID
    target_user_id = request.user_id if request.user_id else user["user_id"]
    
    # # Check if current user has permission to modify permissions
    # if user["role"] != "admin" and target_user_id != user["user_id"]:
    #     has_permission = db.check_user_has_permission(
    #         user_id=user["user_id"],
    #         permission_name="manage_permissions"
    #     )
    #     if not has_permission:
    #         raise HTTPException(status_code=403, detail="Permission denied")
    
    # Check if target user exists
    target_user = db.get_user_details(target_user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")
    
    # Add permission to user
    success = db.add_permission_to_user(
        user_id=target_user_id,
        permission_name=request.permission_name,
        granted_by=user["user_id"]
    )
    
    if not success:
        raise HTTPException(
            status_code=404,
            detail="Message not found or feedback could not be added"
        )

    return {
        "status": "success",
        "message": "Feedback added successfully",
        "feedback_id": success
    }

@app.delete("/api/permissions/user")
async def remove_permission_from_user(
    request: PermissionRequest,
    user = Depends(get_current_user)
):
    """
    Remove a permission from a user.
    
    Args:
        request: Contains permission_name and optional user_id
        
    Returns:
        Success message
    """
    # Determine the target user ID
    target_user_id = request.user_id if request.user_id else user["user_id"]
    
    # # Check if current user has permission to modify permissions
    # if user["role"] != "admin" and target_user_id != user["user_id"]:
    #     has_permission = db.check_user_has_permission(
    #         user_id=user["user_id"],
    #         permission_name="manage_permissions"
    #     )
    #     if not has_permission:
    #         raise HTTPException(status_code=403, detail="Permission denied")
    
    # Admin users can't have permissions removed
    target_user = db.get_user_details(target_user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")
    
    if target_user.get("UserRole") == "admin":
        raise HTTPException(
            status_code=400,
            detail="Cannot remove permissions from admin users"
        )
    
    # Remove permission from user
    success = db.remove_permission_from_user(
        user_id=target_user_id,
        permission_name=request.permission_name,
        removed_by=user["user_id"]
    )
    
    if not success:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to remove permission '{request.permission_name}' from user. User may not have this permission."
        )
    
    return {
        "status": "success", 
        "message": f"Permission '{request.permission_name}' removed from user ID {target_user_id}"
    }

@app.get("/api/permissions/check/{permission_name}")
async def check_user_permission(
    permission_name: str,
    user_id: Optional[int] = None,
    user = Depends(get_current_user)
):
    """
    Check if a user has a specific permission.
    
    Args:
        permission_name: Name of the permission to check
        user_id: Optional user ID to check (defaults to current user)
        
    Returns:
        Whether the user has the permission
    """
    # Determine the target user ID
    target_user_id = user_id if user_id else user["user_id"]
    logger.debug(f'permission check: permission={permission_name}, user={user}, target_user_id={target_user_id}')
    
    # Admin users can check permissions for any user
    # Regular users can only check their own permissions
    if user["role"] != "admin" and target_user_id != user["user_id"]:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Check if target user exists
    target_user = db.get_user_details(target_user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Admin users automatically have all permissions
    if target_user.get("UserRole") == "admin":
        return {"has_permission": True}
    
    # Check if user has the permission - always fetch from database to avoid caching issues
    has_permission = db.check_user_has_permission(
        user_id=target_user_id,
        permission_name=permission_name
    )
    
    # Log the result for debugging purposes
    logger.debug(f'Permission check result for {permission_name}: {has_permission}')
    
    # Return with Cache-Control headers to prevent browser caching
    response = {"has_permission": has_permission}
    
    # Return with headers that prevent caching
    return JSONResponse(
        content=response, 
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )
    
@app.put("/api/users/{user_id}/role")
async def set_user_role(
    user_id: int,
    role: str = Body(..., embed=True),
    current_user = Depends(get_current_user)
):
    """
    Set a user's role (admin or user).
    
    Args:
        user_id: ID of the user to update
        role: New role ('admin' or 'user')
        
    Returns:
        Updated user details
    """
    # Only admins can change user roles
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Validate role
    if role not in ['admin', 'user']:
        raise HTTPException(status_code=400, detail="Invalid role. Must be 'admin' or 'user'")
    
    # Check if user exists
    user_data = db.get_user_details(user_id)
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent changing your own role
    if str(user_id) == str(current_user["user_id"]):
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    
    # Set user role
    success = db.set_user_role(
        user_id=user_id,
        role=role,
        updated_by=current_user["user_id"]
    )
    
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Failed to update user role"
        )
    
    # Get updated user details
    updated_user = db.get_user_details(user_id)
    
    # Remove sensitive information
    if "PasswordHash" in updated_user:
        del updated_user["PasswordHash"]
    
    return updated_user

@app.post("/api/messages/{message_id}/feedback")
async def add_message_feedback(
    message_id: int,
    feedback_request: MessageFeedback,
    user = Depends(get_current_user)
):
    """Add feedback to a specific message."""
    print(f"Adding feedback for message ID {message_id} by user {user['user_id']}")
    try:
        # Validate feedback type
        valid_feedback = ["like", "dislike"]
        if feedback_request.feedback not in valid_feedback:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid feedback type. Must be one of: {', '.join(valid_feedback)}"
            )

        # Add feedback using new database function
        feedback_id = db.add_message_feedback(
            message_id=message_id,
            user_id=user["user_id"],
            comment=feedback_request.feedback
        )

        if not feedback_id:
            raise HTTPException(
                status_code=404,
                detail="Message not found or feedback could not be added"
            )

        return {
            "status": "success",
            "message": "Feedback added successfully",
            "feedback_id": feedback_id
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding feedback: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/messages/{message_id}/rating")
async def add_message_rating(
    message_id: int,
    rating: int = Body(..., ge=1, le=5),
    user = Depends(get_current_user)
):
    """Add or update rating for a specific message."""
    try:
        # Add rating using new database function
        success = db.add_message_rating(
            message_id=message_id,
            user_id=user["user_id"],
            rating=rating
        )

        if not success:
            raise HTTPException(
                status_code=404,
                detail="Message not found or rating could not be added"
            )

        return {
            "status": "success",
            "message": "Rating added successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding rating: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Message endpoints
@app.get("/api/messages/department")
async def get_department_messages(
    department_ids: List[int]= Query(..., alias="department_ids", description="Comma-separated IDs"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user = Depends(get_current_user)
):
    """
    Get all messages from conversations in multiple departments.
    
    Args:
        department_ids: List of department IDs to query
        start_date: Optional start date filter (YYYY-MM-DD) 
        end_date: Optional end date filter (YYYY-MM-DD)
    """
    # Check if user has access to the departments
    if user["role"] != "admin":
        user_details = db.get_user_details(user["user_id"])
        user_depts = [dept.get("DepartmentID") for dept in user_details.get("departments", [])]
        
        # Check if user has access to all requested departments
        for dept_id in department_ids:
            if dept_id not in user_depts:
                raise HTTPException(
                    status_code=403, 
                    detail=f"You do not have access to department {dept_id}"
                )

    # Convert date strings to datetime objects if provided
    start_date_obj = None
    end_date_obj = None
    if start_date:
        try:
            start_date_obj = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
    if end_date:
        try:
            end_date_obj = datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
    
    # Get messages for all target departments
    all_messages = []
    for dept_id in department_ids:
        messages = db.get_department_messages(
            department_id=dept_id,
            start_date=start_date_obj,
            end_date=end_date_obj
        )
        all_messages.extend(messages)
    
    # Sort messages by timestamp if needed
    all_messages.sort(key=lambda x: x.get("CreatedAt", ""), reverse=True)
    
    return {"messages": all_messages}

@app.get("/api/messages")
async def get_all_messages(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: Optional[int] = 1000,
    user = Depends(get_current_user)
):
    """
    Get all messages across all conversations.
    Only admin users can access this endpoint.
    
    Args:
        start_date: Optional start date filter (YYYY-MM-DD)
        end_date: Optional end date filter (YYYY-MM-DD)
        limit: Maximum number of messages to return (default 1000)
    """
    # Only admin users can get all messages
    if user["role"] != "admin" and user["role"] != "full-admin":
        raise HTTPException(status_code=403, detail="Only admin users can access all messages")

    # Convert date strings to datetime objects if provided
    start_date_obj = None
    end_date_obj = None
    if start_date:
        try:
            start_date_obj = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
    if end_date:
        try:
            end_date_obj = datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")

    messages = db.get_all_messages(
        start_date=start_date_obj,
        end_date=end_date_obj,
        limit=limit
    )
    
    return {"messages": messages}



@app.get("/api/agents/config/{api_key}")
async def get_agent_config_by_api_key(api_key: str):
    """
    Retrieve agent configuration based on API key.
    
    Args:
        api_key: The API key associated with the agent.
        
    Returns:
        JSON object containing agent configuration and shared agent name.
    """
    try:
        # Verify the API key
        api_key_data = verify_api_key(api_key)
        if not api_key_data:
            raise HTTPException(status_code=401, detail="Invalid or expired API key")

        # Retrieve agent details using the agent_id from the API key
        agent_id = api_key_data.get("agent_id")
        agent_data = db.get_agent(agent_id=agent_id)
        if not agent_data:
            raise HTTPException(status_code=404, detail="Agent not found")

        # Retrieve shared agent details
        shared_agent = db.get_shared_agent_by_api_key(api_key)
        shared_agent_name = shared_agent.get("Name") if shared_agent else "Unknown"
        shared_agent_origins = shared_agent.get("AllowedOrigins", []) if shared_agent else []

        # Parse the agent configuration
        config = json.loads(agent_data.get("Configuration", "{}"))
        model_name = config.get("model")
        department_id = agent_data.get("DepartmentID")
        agent_key = agent_data.get("AgentKey")

        # Return the required JSON structure
        return {
            "model": model_name,
            "department_id": department_id,
            "agent_key": agent_key,
            "shared_agent_name": shared_agent_name,
            "allowed_origins":shared_agent_origins,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving agent configuration: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve agent configuration")


@app.post("/api/permissions", response_model=dict)
async def add_permissions(data: FixPermission, user = Depends(get_current_user)):
    """
    Add permissions.
    
    Args:
        data: Contains permission_name
        
    Returns:
        Success message
    """
    print(f"Adding permission: {data}")
    # # Check if user has permission to manage permissions
    # if user["role"] != "admin":
    #     has_permission = db.check_user_has_permission(
    #         user_id=user["user_id"],
    #         permission_name="manage_permissions"
    #     )
    #     if not has_permission:
    #         raise HTTPException(status_code=403, detail="Permission denied")
    
    # check permission exists
    permission_exists = db.check_permission(data.permission_name)
    if permission_exists:
        raise HTTPException(status_code=404, detail=f"Permission '{data.permission_name}' does not exist")

    # Add permission
    permission_id = db.add_permission(
        permission_name=data.permission_name,
        description=data.description,
    )
    
    if not permission_id:
        raise HTTPException(
            status_code=404,
            detail="Failed to add permission"
        )
    
    return {'permission_id':permission_id}

@app.put('/api/permissions/{permission_id}')
async def update_permission(
    permission_id: int,
    data: Permission,
    user = Depends(get_current_user)
):
    """
    Update an existing permission.
    
    Args:
        permission_id: ID of the permission to update
        data: Contains updated permission_name and optional description
        
    Returns:
        Updated permission details
    """
    # # Check if user has permission to manage permissions
    # if user["role"] != "admin":
    #     has_permission = db.check_user_has_permission(
    #         user_id=user["user_id"],
    #         permission_name="manage_permissions"
    #     )
    #     if not has_permission:
    #         raise HTTPException(status_code=403, detail="Permission denied")
    
    # Validate input
    if not data.permission_name:
        raise HTTPException(status_code=400, detail="permission_name is required")
    
    # Update the permission
    success = db.update_permission(
        permission_id=permission_id,
        permission_name=data.permission_name,
        description=data.description
    )
    
    if not success:
        raise HTTPException(
            status_code=404,
            detail="Failed to update permission"
        )
    
    # Get the updated permission details
    updated_permission = db.get_permission(permission_id)
    
    return updated_permission


@app.delete("/api/permissions/{permission_id}", response_model=dict)
async def delete_permission(
    permission_id: int,
    user = Depends(get_current_user)
):
    """
    Delete a permission.
    
    Args:
        permission_id: ID of the permission to delete
        
    Returns:
        Success message
    """
    # # Check if user has permission to manage permissions
    # if user["role"] != "admin":
    #     has_permission = db.check_user_has_permission(
    #         user_id=user["user_id"],
    #         permission_name="manage_permissions"
    #     )
    #     if not has_permission:
    #         raise HTTPException(status_code=403, detail="Permission denied")
    
    # Check if permission exists
    existing_permission = db.get_permission(permission_id)
    if not existing_permission:
        raise HTTPException(status_code=404, detail="Permission not found")
    
    # Delete the permission
    success = db.delete_permission(permission_id)
    
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Failed to delete permission"
        )
    
    return {"status": "success", "message": f"Permission with ID {permission_id} deleted successfully"}

@app.get("/api/all-api", response_model=List[Route])
async def get_all_routes(user = Depends(get_current_user)):
    """
    Get all available routes in the system.
    
    Returns:
        List of all routes with their details
    """
    # Only admin users can access this information
    if user["role"] != "admin" and user["role"] != "full-admin":
        raise HTTPException(status_code=403, detail="Only admin users can access all routes")
    
    # Get all routes from the app
    routes = []
    for route in app.routes:
        # Extract the path, methods, and other properties
        if hasattr(route, "path"):
            # Get methods - handle different route types
            methods = []
            if hasattr(route, "methods"):
                methods = list(route.methods)
            
            # Get summary and description from the endpoint function if available
            summary = None
            description = None
            if hasattr(route, "endpoint") and hasattr(route.endpoint, "__doc__") and route.endpoint.__doc__:
                doc_lines = route.endpoint.__doc__.strip().split("\n")
                if doc_lines:
                    summary = doc_lines[0].strip()
                    if len(doc_lines) > 1:
                        description = "\n".join(line.strip() for line in doc_lines[1:]).strip()
            
            # Create route info object
            route_info = Route(
                path=route.path,
                methods=methods,
                summary=summary,
                description=description
            )
            
            # Only include API routes (filter out docs, OpenAPI, etc.)
            if route.path.startswith("/api/"):
                routes.append(route_info)
    
    # Sort routes by path for easier reading
    routes.sort(key=lambda x: x.path)
    
    logger.info(f"Retrieved {len(routes)} API routes")
    return routes


@app.get("/api/api-permissions", response_model=List[APIPermission])
async def get_api_permissions(user = Depends(get_current_user)):
    """
    Get all API permissions available in the system.
    
    Returns:
        List of API permissions with their details
    """
    # Only admin users can access this information
    if user["role"] != "admin" and user["role"] != "full-admin":
        raise HTTPException(status_code=403, detail="Only admin users can access API permissions")
    
    # Get all API permissions from the database
    api_permissions_data = db.get_all_api_permissions()
    
    if not api_permissions_data:
        return []
    
    # Convert DB dict to Pydantic model format
    api_permissions = []
    for perm in api_permissions_data:
        api_permissions.append(APIPermission(
            ApiPermissionID=perm.get("ApiPermissionID"),
            RequiredPermission=perm.get("RequiredPermission"),
            Method=perm.get("Method"),
            PathPattern=perm.get("PathPattern"),
        ))
    
    return api_permissions

@app.post("/api/api-permissions", response_model=APIPermission)
async def add_api_permission(
    api_permission: APIPermission,
    user = Depends(get_current_user)
):
    """
    Add a new API permission.
    
    Args:
        api_permission: Contains RequiredPermission, Method, and PathPattern
        
    Returns:
        Newly created API permission details
    """
    # # Check if user has permission to manage API permissions
    # if user["role"] != "admin":
    #     has_permission = db.check_user_has_permission(
    #         user_id=user["user_id"],
    #         permission_name="manage_api_permissions"
    #     )
    #     if not has_permission:
    #         raise HTTPException(status_code=403, detail="Permission denied")
    
    # Add the API permission
    api_permission_id = db.add_api_permission(
        permission_name=api_permission.RequiredPermission,
        method=api_permission.Method,
        api_path=api_permission.PathPattern
    )
    
    if not api_permission_id:
        raise HTTPException(
            status_code=400, 
            detail="Failed to add API permission"
        )
    
    # Get the created API permission details
    created_api_permission = db.get_api_permission(api_permission_id)
    
    return APIPermission(
        ApiPermissionID=created_api_permission.get("ApiPermissionID"),
        RequiredPermission=created_api_permission.get("RequiredPermission"),
        Method=created_api_permission.get("Method"),
        PathPattern=created_api_permission.get("PathPattern"),
    )


@app.put("/api/api-permissions/{api_permission_id}", response_model=APIPermission)
async def update_api_permission(
    api_permission_id: int,
    api_permission: APIPermission,
    user = Depends(get_current_user)
):
    """
    Update an existing API permission.
    
    Args:
        api_permission_id: ID of the API permission to update
        api_permission: Contains updated RequiredPermission, Method, and PathPattern
        
    Returns:
        Updated API permission details
    """
    # # Check if user has permission to manage API permissions
    # if user["role"] != "admin":
    #     has_permission = db.check_user_has_permission(
    #         user_id=user["user_id"],
    #         permission_name="manage_api_permissions"
    #     )
    #     if not has_permission:
    #         raise HTTPException(status_code=403, detail="Permission denied")
    
    # Validate input
    if not api_permission.RequiredPermission or not api_permission.Method or not api_permission.PathPattern:
        raise HTTPException(status_code=400, detail="RequiredPermission, Method, and PathPattern are required")
    
    # Update the API permission
    success = db.update_api_permission(
        api_permission_id=api_permission_id,
        required_permission=api_permission.RequiredPermission,
        method=api_permission.Method,
        path_pattern=api_permission.PathPattern
    )
    
    if not success:
        raise HTTPException(
            status_code=404,
            detail="Failed to update API permission"
        )
    
    # Get the updated API permission details
    updated_api_permission = db.get_api_permission(api_permission_id)
    
    return APIPermission(
        ApiPermissionID=updated_api_permission.get("ApiPermissionID"),
        RequiredPermission=updated_api_permission.get("RequiredPermission"),
        Method=updated_api_permission.get("Method"),
        PathPattern=updated_api_permission.get("PathPattern"),
    )


@app.delete("/api/api-permissions/{api_permission_id}", response_model=dict)
async def delete_api_permission(
    api_permission_id: int,
    user = Depends(get_current_user)
):
    """
    Delete an API permission.
    
    Args:
        api_permission_id: ID of the API permission to delete
        
    Returns:
        Success message
    """
    # # Check if user has permission to manage API permissions
    # if user["role"] != "admin":
    #     has_permission = db.check_user_has_permission(
    #         user_id=user["user_id"],
    #         permission_name="manage_api_permissions"
    #     )
    #     if not has_permission:
    #         raise HTTPException(status_code=403, detail="Permission denied")
    
    # Check if API permission exists
    existing_api_permission = db.get_api_permission(api_permission_id)
    if not existing_api_permission:
        raise HTTPException(status_code=404, detail="API permission not found")
    
    # Delete the API permission
    success = db.delete_api_permission(api_permission_id)
    
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Failed to delete API permission"
        )
    
    return {"status": "success", "message": f"API permission with ID {api_permission_id} deleted successfully"}

# Add these functions after the helper functions section and before the API routes

async def load_chat_history(chat_id: str) -> List[tuple]:
    """Load existing chat history from a file based on chat_id"""
    try:

        
        # Create chat history directory if it doesn't exist
        chat_dir = os.path.join("chat_history").replace('\\', '/')
        os.makedirs(chat_dir, exist_ok=True)
        
        # Construct the full file path
        file_path = os.path.join(chat_dir, f"{chat_id}.json").replace('\\', '/')
        
        # Check if the file exists
        if not os.path.exists(file_path):
            logger.info(f"No existing chat history for chat_id: {chat_id}")
            return []
            
        # Read the chat history from the file in JSON format
        chat_history = []
        with open(file_path, "r", encoding="utf-8") as f:
            chat_data = json.load(f)
            
            for message in chat_data:
                role = message.get("role", "human")
                content = message.get("content", "")
                
                # Map custom roles to standard LLM roles to avoid "Unexpected message type" error
                if role in ["user", "human"]:
                    mapped_role = "human"
                elif role in ["assistant", "ai", "bot"]:
                    mapped_role = "ai"
                elif role in ["system"]:
                    mapped_role = "system"
                else:
                    # Default to human for unrecognized roles
                    logger.warning(f"Unrecognized role '{role}' in chat history, defaulting to 'human'")
                    mapped_role = "human"
                
                chat_history.append((mapped_role, content))
        
        logger.info(f"Loaded {len(chat_history)} messages from chat history for chat_id: {chat_id}")
        return chat_history
        
    except Exception as e:
        logger.error(f"Error loading chat history for chat_id {chat_id}: {str(e)}")
        return []  # Return empty history on error

def load_chat_history_metadata():
    """Load chat history metadata from file"""
    try:
        metadata_file = os.path.join("chat_history", "metadata.json").replace('\\', '/')
        if os.path.exists(metadata_file):
            with open(metadata_file, "r", encoding="utf-8") as f:
                metadata = json.load(f)
                print(f"Loaded chat history metadata: {metadata}")
                return metadata
        return {}
    except Exception as e:
        logger.error(f"Error loading chat history metadata: {str(e)}")
        return {}

def save_chat_history_metadata(metadata):
    """Save chat history metadata to file"""
    try:
        chat_dir = os.path.join("chat_history").replace('\\', '/')
        os.makedirs(chat_dir, exist_ok=True)
        
        metadata_file = os.path.join(chat_dir, "metadata.json").replace('\\', '/')
        with open(metadata_file, "w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        logger.error(f"Error saving chat history metadata: {str(e)}")
        return False

async def save_chat_history(chat_id: str, messages: List[ChatMessage]) -> bool:
    """Save chat history to a file based on chat_id"""
    try:
        # Create chat history directory if it doesn't exist
        chat_dir = os.path.join("chat_history").replace('\\', '/')
        os.makedirs(chat_dir, exist_ok=True)
        
        # Load existing metadata
        metadata = load_chat_history_metadata()
        
        
        # Update the last accessed time for this chat_id
        current_time = time.time()
        metadata[chat_id] = current_time
        
        # Save updated metadata
        save_chat_history_metadata(metadata)
        
        # Clean up old chat histories that haven't been accessed in an hour
        cleanup_old_chat_histories()
        
        # Construct the full file path
        file_path = os.path.join(chat_dir, f"{chat_id}.json").replace('\\', '/')
        
        # Convert messages to a serializable format
        new_messages = []
        for msg in messages:
            # Map role to standard format before saving
            role = msg.role
            if role in ["user", "human"]:
                standard_role = "human"
            elif role in ["assistant", "ai", "bot"]:
                standard_role = "ai"
            elif role in ["system"]:
                standard_role = "system"
            else:
                # Default to human for unrecognized roles
                logger.warning(f"Unrecognized role '{role}' in message, defaulting to 'human'")
                standard_role = "human"
            
            new_messages.append({
                "role": standard_role,
                "content": msg.content
            })
        
        # Read existing messages if file exists
        existing_messages = []
        if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    existing_messages = json.load(f)
                    if not isinstance(existing_messages, list):
                        logger.warning(f"Existing chat history in {file_path} is not a valid JSON array. Creating a new file.")
                        existing_messages = []
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse existing chat history in {file_path}. Creating a new file.")
                existing_messages = []
        
        # Combine existing and new messages
        all_messages = existing_messages + new_messages
        
        # Write the complete chat history to the file in JSON format
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(all_messages, f, ensure_ascii=False, indent=2)
        
        logger.info(f"Saved {len(messages)} messages to chat history for chat_id: {chat_id}")
        return True
        
    except Exception as e:
        logger.error(f"Error saving chat history for chat_id {chat_id}: {str(e)}")
        return False  # Return False on error

def cleanup_old_chat_histories():
    """Delete chat history files that haven't been accessed in over an hour"""
    try:
        current_time = time.time()
        one_hour_in_seconds = 10  # 1 hour = 3600 seconds
        chat_history_last_accessed = load_chat_history_metadata()
        # Check each chat_id in our tracking dictionary
        for chat_id, last_accessed in list(chat_history_last_accessed.items()):
            print(f'chat_history_items:{chat_history_last_accessed.items()}')
            print(f"Checking chat_id: {chat_id}, last accessed: {last_accessed}")
            print(f'current_time: {current_time}, last_accessed: {last_accessed}, difference: {current_time - last_accessed}')
            if current_time - last_accessed > one_hour_in_seconds:
                print(f'current_time: {current_time}, last_accessed: {last_accessed}, difference: {current_time - last_accessed}')
                # This chat hasn't been accessed in over an hour, delete its file
                file_path = os.path.join("chat_history", f"{chat_id}.json").replace('\\', '/')
                if os.path.exists(file_path):
                    os.remove(file_path)
                    logger.info(f"Deleted inactive chat history for chat_id: {chat_id}")
                
    except Exception as e:
        logger.error(f"Error cleaning up old chat histories: {str(e)}")


@app.post("/api/forgot-password")
async def forgot_password(email: str = Body(..., embed=True)):
    """
    Handle forgot password request.
    
    Args:
        email: User's email address
        
    Returns:
        Success message
    """
    print(f"Received forgot password request for email: {email}")
    # Validate email format
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address")
    
    # Check if user exists
    user = db.get_user_by_email(email)
    print(f"User found: {user}")
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Notify the user via email
    try:

        # Email configuration
        smtp_server = os.getenv("SMTP_SERVER")
        smtp_port = int(os.getenv("SMTP_PORT", 587))
        smtp_user = os.getenv("SMTP_USER")
        smtp_password = os.getenv("SMTP_PASSWORD")
        sender_email = smtp_user

        # Create email for user
        user_subject = "Password Reset Request"
        user_body = f"Dear {user['Username']},\n\nPlease reset your password using the link provided.\n\nBest regards,\nSupport Team"
        user_message = MIMEMultipart()
        user_message["From"] = sender_email
        user_message["To"] = email
        user_message["Subject"] = user_subject
        user_message.attach(MIMEText(user_body, "plain"))

        # Send email to user
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(sender_email, email, user_message.as_string())
        logger.info(f"Password reset email sent to {email}")

        # Notify admins about the forgot password request
        admin_emails = db.get_admin_emails()  # Fetch emails of users with admin role
        admin_subject = "Forgot Password Notification"
        admin_body = f"User with email {email} has requested a password reset."
        for admin_email in admin_emails:
            admin_message = MIMEMultipart()
            admin_message["From"] = sender_email
            admin_message["To"] = admin_email
            admin_message["Subject"] = admin_subject
            admin_message.attach(MIMEText(admin_body, "plain"))

            # Send email to admin
            with smtplib.SMTP(smtp_server, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.sendmail(sender_email, admin_email, admin_message.as_string())
            logger.info(f"Notification email sent to admin {admin_email}")

        return {"message": "Notification has been sent to the user and admins"}
    except Exception as e:
        logger.error(f"Error sending notification email: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to send notification email")


class ContactAdminRequest(BaseModel):
    email: str
    content: str

@app.post("/api/contact-admin")
async def contact_admin(
    contact_request: ContactAdminRequest
):
    """
    Allow users to contact the admin.
    
    Args:
        contact_request: Contains email and content of the message
        
    Returns:
        Success message
    """
    # Validate email format
    if not contact_request.email or "@" not in contact_request.email:
        raise HTTPException(status_code=400, detail="Invalid email address")
    user = db.get_user_by_email(contact_request.email)
    # Check if user is authenticated
    if not user:
        raise HTTPException(status_code=401, detail="User not authenticated")
    
    # Notify the admin via email
    try:
        # Email configuration
        smtp_server = os.getenv("SMTP_SERVER")
        smtp_port = int(os.getenv("SMTP_PORT", 587))
        smtp_user = os.getenv("SMTP_USER")
        smtp_password = os.getenv("SMTP_PASSWORD")
        sender_email = smtp_user

        # Create email for admin
        admin_subject = f"Contact from {user['Username']} ({contact_request.email})"
        admin_body = f"User {user['Username']} ({contact_request.email}) has sent a message:\n\n{contact_request.content}"
        admin_message = MIMEMultipart()
        admin_message["From"] = sender_email
        admin_message["To"] = smtp_user  # Send to the admin's email
        admin_message["Subject"] = admin_subject
        admin_message.attach(MIMEText(admin_body, "plain"))

        # Send email to admin
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(sender_email, smtp_user, admin_message.as_string())
        
        logger.info(f"Contact request from {user['Username']} sent to admin")
 
        return {"message": "Your message has been sent to the admin"}

    except Exception as e:
        logger.error(f"Error sending contact request: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))