# One container, one public URL: FastAPI serves the built React app and the API,
# and a tiny mock AEM author runs beside it on 127.0.0.1:4502.

FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
COPY --from=web /web/dist frontend/dist

ENV AEM_MODE=mock \
    AEM_HOST=http://127.0.0.1:4502 \
    PYTHONUNBUFFERED=1
WORKDIR /app/backend

# GEMINI_API_KEY must be provided by the platform. $PORT is set by most hosts (Render, Railway, Cloud Run).
CMD ["sh", "-c", "uvicorn mock_aem_server:app --host 127.0.0.1 --port 4502 & exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
