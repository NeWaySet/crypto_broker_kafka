#!/usr/bin/env python3
import json
import os
import threading
import time
import uuid
from collections import deque
from datetime import datetime, timezone

from flask import Flask, jsonify, render_template, request
from kafka import KafkaConsumer, KafkaProducer
from kafka.errors import NoBrokersAvailable


BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
CHAT_INPUT_TOPIC = os.getenv("KAFKA_CHAT_INPUT_TOPIC", "messages.raw")
SENSOR_INPUT_TOPIC = os.getenv("KAFKA_SENSOR_INPUT_TOPIC", "sensors.raw")
CHAT_OUTPUT_TOPIC = os.getenv("KAFKA_CHAT_OUTPUT_TOPIC", "messages.filtered")
SENSOR_OUTPUT_TOPIC = os.getenv("KAFKA_SENSOR_OUTPUT_TOPIC", "sensors.data.filtered")
GROUP_ID = os.getenv("KAFKA_GROUP_ID", "web-ui")

app = Flask(__name__)
producer: KafkaProducer | None = None
messages = deque(maxlen=50)
sensors = deque(maxlen=50)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def kafka_producer() -> KafkaProducer:
    global producer
    if producer is not None:
        return producer

    for attempt in range(1, 31):
        try:
            producer = KafkaProducer(
                bootstrap_servers=BOOTSTRAP_SERVERS,
                value_serializer=lambda value: json.dumps(value, ensure_ascii=False).encode("utf-8"),
                acks="all",
                retries=5,
            )
            return producer
        except NoBrokersAvailable:
            print(f"Kafka is starting, attempt {attempt}/30...")
            time.sleep(2)
    raise RuntimeError("Could not connect to Kafka")


def consume_filtered() -> None:
    while True:
        try:
            consumer = KafkaConsumer(
                CHAT_OUTPUT_TOPIC,
                SENSOR_OUTPUT_TOPIC,
                bootstrap_servers=BOOTSTRAP_SERVERS,
                group_id=f"{GROUP_ID}-{uuid.uuid4()}",
                auto_offset_reset="latest",
                enable_auto_commit=True,
                value_deserializer=lambda raw: json.loads(raw.decode("utf-8")),
            )
            for record in consumer:
                if record.topic == CHAT_OUTPUT_TOPIC:
                    messages.appendleft(record.value)
                else:
                    sensors.appendleft(record.value)
        except Exception as exc:
            print(f"web-ui consumer error: {exc}")
            time.sleep(2)


@app.route("/")
def index():
    return render_template("index.html")


@app.post("/api/messages")
def send_message():
    body = request.get_json(force=True)
    sender = str(body.get("sender", "student")).strip()[:40] or "student"
    text = str(body.get("message", "")).strip()
    if not text:
        return jsonify({"error": "message is empty"}), 400

    payload = {
        "kind": "chat",
        "sender": sender,
        "message": text,
        "source": "web:chat",
        "timestamp": now_iso(),
    }
    metadata = kafka_producer().send(CHAT_INPUT_TOPIC, value=payload).get(timeout=15)
    return jsonify({"status": "sent", "topic": CHAT_INPUT_TOPIC, "offset": metadata.offset, "payload": payload})


@app.post("/api/sensors")
def send_sensor():
    body = request.get_json(force=True)
    try:
        temperature = float(body.get("temperature"))
        humidity = float(body.get("humidity"))
    except (TypeError, ValueError):
        return jsonify({"error": "temperature and humidity must be numbers"}), 400

    payload = {
        "kind": "sensor",
        "sensor_id": str(body.get("sensor_id", "sensor_web")).strip()[:40] or "sensor_web",
        "temperature": temperature,
        "humidity": humidity,
        "source": "web:sensor",
        "timestamp": now_iso(),
    }
    metadata = kafka_producer().send(SENSOR_INPUT_TOPIC, value=payload).get(timeout=15)
    return jsonify({"status": "sent", "topic": SENSOR_INPUT_TOPIC, "offset": metadata.offset, "payload": payload})


@app.get("/api/state")
def state():
    return jsonify({"messages": list(messages), "sensors": list(sensors)})


if __name__ == "__main__":
    threading.Thread(target=consume_filtered, daemon=True).start()
    kafka_producer()
    app.run(host="0.0.0.0", port=8080)
