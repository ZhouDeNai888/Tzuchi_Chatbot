# ใช้ FastAPI base image ที่รองรับ Python 3.11
FROM tiangolo/uvicorn-gunicorn-fastapi:python3.11

# ตั้งค่า directory หลัก
WORKDIR /app

# ติดตั้ง System Dependencies และ Microsoft ODBC Driver 17
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    apt-transport-https \
    unixodbc \
    unixodbc-dev \
    odbcinst \
    libodbc1 \
    # Playwright dependencies
    libnss3 \
    libnspr4 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libxkbcommon0 \
    libasound2 \
    && curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add - \
    && curl https://packages.microsoft.com/config/ubuntu/20.04/prod.list > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update && ACCEPT_EULA=Y apt-get install -y msodbcsql17 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements.txt เป็นลำดับแรก
COPY requirements.txt /tmp/requirements.txt

# ติดตั้ง dependencies ก่อนเพื่อใช้ layer cache ได้
RUN pip install --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r /tmp/requirements.txt

# ติดตั้ง Playwright browsers
RUN playwright install

# ค่อย copy โค้ดอื่นๆ หลังจากติดตั้งเสร็จ
COPY . /app/

# สร้างโฟลเดอร์ที่จำเป็น
RUN mkdir -p /app/bm25_data /app/pdf /app/uploaded_files /app/qdrant_and_hash_gpt40_mini

# เปิด port 8000
EXPOSE 8000

# ใช้ Uvicorn ในการรัน FastAPI with reload for development
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
