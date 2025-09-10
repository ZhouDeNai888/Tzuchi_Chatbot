FROM python:3.11-slim-bullseye

WORKDIR /app

# ติดตั้ง dependencies
RUN apt-get update && apt-get install -y \
    curl gnupg apt-transport-https \
    unixodbc unixodbc-dev odbcinst libodbc1 \
    libnss3 libnspr4 libdbus-1-3 libatk1.0-0 \
    libatk-bridge2.0-0 libatspi2.0-0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 \
    libxkbcommon0 libasound2 \
 && curl https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > /usr/share/keyrings/ms-packages.gpg \
 && echo "deb [signed-by=/usr/share/keyrings/ms-packages.gpg] https://packages.microsoft.com/debian/11/prod bullseye main" > /etc/apt/sources.list.d/microsoft-prod.list \
 && apt-get update \
 && ACCEPT_EULA=Y apt-get install -y msodbcsql17 \
 && rm -rf /var/lib/apt/lists/*

# copy requirements ก่อนเพื่อ cache
COPY requirements.txt /tmp/requirements.txt

RUN pip install --upgrade pip setuptools wheel \
 && pip install --no-cache-dir -r /tmp/requirements.txt \
 && python -m playwright install chromium

# copy โค้ด
COPY . /app/

# โฟลเดอร์ที่ต้องใช้
RUN mkdir -p /app/bm25_data /app/pdf /app/uploaded_files /app/qdrant_and_hash_gpt40_mini

EXPOSE 8000

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
