#!/usr/bin/env python3
import json
import os
import re
import time
from datetime import datetime, timezone

from cryptography.fernet import Fernet, InvalidToken
from kafka import KafkaConsumer, KafkaProducer
from kafka.errors import NoBrokersAvailable


BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
INPUT_TOPIC = os.getenv("KAFKA_INPUT_TOPIC", "sensors.crypto")
OUTPUT_TOPIC = os.getenv("KAFKA_OUTPUT_TOPIC", "sensors.data.filtered")
GROUP_ID = os.getenv("KAFKA_GROUP_ID", "sensor-filter")
CRYPTO_KEY = os.environ["CRYPTO_KEY"].encode("utf-8")


class CryptoContainerAdapter:
    def __init__(self, key: bytes):
        self.fernet = Fernet(key)

    def open(self, container: dict) -> dict:
        if container.get("container_version") != "1.0":
            raise ValueError("unsupported_crypto_container")
        token = container["ciphertext"].encode("utf-8")
        plaintext = self.fernet.decrypt(token)
        return json.loads(plaintext.decode("utf-8"))


class Sanitizer:
    SCRIPT_RE = re.compile(r"<\s*script.*?>.*?<\s*/\s*script\s*>", re.IGNORECASE | re.DOTALL)

    def clean(self, payload: dict) -> dict:
        cleaned = dict(payload)
        if "text" in cleaned:
            text = str(cleaned["text"])
            text = self.SCRIPT_RE.sub("", text)
            cleaned["text"] = text[:240]
        return cleaned


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def validate(payload: dict) -> tuple[bool, str]:
    has_temperature = "temperature" in payload
    has_humidity = "humidity" in payload

    if not has_temperature and not has_humidity:
        return True, "text-message"

    try:
        temperature = float(payload.get("temperature"))
        humidity = float(payload.get("humidity"))
    except (TypeError, ValueError):
        return False, "temperature/humidity must be numbers"

    if not -20.0 <= temperature <= 50.0:
        return False, "temperature outside -20..50 C"
    if not 0.0 <= humidity <= 100.0:
        return False, "humidity outside 0..100 %"
    return True, "sensor-data"


def connect() -> tuple[KafkaConsumer, KafkaProducer]:
    for attempt in range(1, 31):
        try:
            consumer = KafkaConsumer(
                INPUT_TOPIC,
                bootstrap_servers=BOOTSTRAP_SERVERS,
                group_id=GROUP_ID,
                auto_offset_reset="earliest",
                enable_auto_commit=True,
                value_deserializer=lambda raw: json.loads(raw.decode("utf-8")),
            )
            producer = KafkaProducer(
                bootstrap_servers=BOOTSTRAP_SERVERS,
                value_serializer=lambda value: json.dumps(value, ensure_ascii=False).encode("utf-8"),
                acks="all",
                retries=5,
            )
            return consumer, producer
        except NoBrokersAvailable:
            print(f"Kafka is starting, attempt {attempt}/30...")
            time.sleep(2)
    raise RuntimeError("Could not connect to Kafka")


def main() -> None:
    print("=" * 64)
    print("Secure filter: sensors.crypto -> sensors.data.filtered")
    print("=" * 64)
    print(f"Broker: {BOOTSTRAP_SERVERS}")
    print(f"Input:  {INPUT_TOPIC}")
    print(f"Output: {OUTPUT_TOPIC}")
    print("-" * 64)

    opener = CryptoContainerAdapter(CRYPTO_KEY)
    sanitizer = Sanitizer()
    consumer, producer = connect()
    try:
        for message in consumer:
            try:
                payload = opener.open(message.value)
            except (InvalidToken, KeyError, ValueError) as exc:
                print(f"DROP crypto_error={exc}")
                continue

            payload = sanitizer.clean(payload)
            is_valid, reason = validate(payload)
            payload["validated_at"] = now_iso()
            payload["validation_result"] = reason

            if is_valid:
                producer.send(OUTPUT_TOPIC, value=payload).get(timeout=15)
                print(f"OK -> {json.dumps(payload, ensure_ascii=False)}")
            else:
                print(f"DROP ({reason}) -> {json.dumps(payload, ensure_ascii=False)}")
    finally:
        consumer.close()
        producer.close()


if __name__ == "__main__":
    main()
