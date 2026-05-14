FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y gcc cargo && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir kafka-python-ng==2.2.3

COPY app.py .

CMD ["python", "-u", "app.py"]
