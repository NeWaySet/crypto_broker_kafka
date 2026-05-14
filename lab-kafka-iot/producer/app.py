#!/usr/bin/env python3
import json
import os
import random
import sys
import time
from datetime import datetime, timezone

from kafka import KafkaProducer
from kafka.errors import NoBrokersAvailable


BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
CHAT_TOPIC = os.getenv("KAFKA_CHAT_TOPIC", "messages.raw")
SENSOR_TOPIC = os.getenv("KAFKA_SENSOR_TOPIC", "sensors.raw")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def sample_sensor_message() -> dict:
    return {
        "kind": "sensor",
        "sensor_id": "manual-demo",
        "temperature": round(random.uniform(18, 34), 2),
        "humidity": round(random.uniform(35, 85), 2),
        "source": "producer:/sample",
        "timestamp": now_iso(),
    }


def parse_user_message(raw: str) -> tuple[str, dict]:
    raw = raw.strip()
    if not raw:
        raise ValueError("Empty message was not sent")

    if raw == "/sample":
        return SENSOR_TOPIC, sample_sensor_message()

    try:
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            raise ValueError('JSON must be an object, for example {"message": "..."}')
        payload.setdefault("timestamp", now_iso())
        if "temperature" in payload or "humidity" in payload:
            payload.setdefault("kind", "sensor")
            payload.setdefault("source", "producer:sensor")
            return SENSOR_TOPIC, payload
        payload.setdefault("kind", "chat")
        payload.setdefault("sender", "cli")
        payload.setdefault("message", payload.pop("text", ""))
        payload.setdefault("source", "producer:chat")
        return CHAT_TOPIC, payload
    except json.JSONDecodeError:
        return CHAT_TOPIC, {
            "kind": "chat",
            "sender": "cli",
            "message": raw,
            "source": "producer:chat",
            "timestamp": now_iso(),
        }


def connect_with_retry() -> KafkaProducer:
    for attempt in range(1, 31):
        try:
            producer = KafkaProducer(
                bootstrap_servers=BOOTSTRAP_SERVERS,
                value_serializer=lambda value: json.dumps(value, ensure_ascii=False).encode("utf-8"),
                acks="all",
                retries=5,
            )
            print(f"Producer connected to Kafka: {BOOTSTRAP_SERVERS}")
            return producer
        except NoBrokersAvailable:
            print(f"Kafka is starting, attempt {attempt}/30...")
            time.sleep(2)
    raise RuntimeError("Could not connect to Kafka")


def main() -> int:
    print("=" * 64)
    print("Secure Kafka producer: chat and sensor input")
    print("=" * 64)
    print(f"Chat topic:   {CHAT_TOPIC}")
    print(f"Sensor topic: {SENSOR_TOPIC}")
    print("Text goes to chat. JSON with temperature/humidity goes to sensors. /sample sends sensor data.")
    print("Exit: /quit or Ctrl+C")
    print("-" * 64)

    producer = connect_with_retry()
    sent_count = 0
    try:
        while True:
            raw = input("> ")
            if raw.strip() in {"/quit", "/exit"}:
                break
            try:
                topic, payload = parse_user_message(raw)
            except ValueError as exc:
                print(exc)
                continue

            metadata = producer.send(topic, value=payload).get(timeout=15)
            sent_count += 1
            print(
                f"Sent #{sent_count}: topic={topic}, partition={metadata.partition}, "
                f"offset={metadata.offset}, payload={json.dumps(payload, ensure_ascii=False)}"
            )
    except (KeyboardInterrupt, EOFError):
        print()
    finally:
        producer.flush()
        producer.close()
        print(f"Producer stopped. Sent messages: {sent_count}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
