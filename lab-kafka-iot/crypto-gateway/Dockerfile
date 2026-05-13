FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir kafka-python-ng==2.2.3 cryptography==42.0.8

COPY app.py .

CMD ["python", "-u", "app.py"]
