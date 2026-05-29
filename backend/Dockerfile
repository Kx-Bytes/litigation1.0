FROM python:3.12-slim

WORKDIR /app

# Build tools needed by eyecite → fast-diff-match-patch (C++ extension)
RUN apt-get update && apt-get install -y --no-install-recommends g++ && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install uv --no-cache-dir

# Copy dependency files first (layer cache)
COPY pyproject.toml .

# Install dependencies (no editable install in container)
RUN uv pip install --system --no-cache .

# Copy source
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
