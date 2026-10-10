FROM python:3.11-slim

WORKDIR /app

# System deps needed to build psycopg2-binary's wheels on some platforms
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p static/logos static/signatures logs \
    && useradd --create-home --shell /bin/false appuser \
    && chown -R appuser:appuser /app \
    && chmod +x entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
