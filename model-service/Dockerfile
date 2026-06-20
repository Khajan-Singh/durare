FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libgomp1 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# The trained model is too large to commit to the repo, so we fetch it from
# the Lovable Assets CDN at image build time. Override MODEL_URL in Render
# env vars if you host the model somewhere else.
ARG MODEL_URL=https://durare.lovable.app/__l5e/assets-v1/8e18551f-f63e-42b7-a84e-194e013c781a/xgboost_model.json
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && curl -fsSL "$MODEL_URL" -o /app/xgboost_model.json \
    && rm -rf /var/lib/apt/lists/*

ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]