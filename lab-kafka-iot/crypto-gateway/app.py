#!/usr/bin/env python3
import json
import os
import time
import uuid
from datetime import datetime, timezone

from cryptography.fernet import Fernet
from kafka import KafkaConsumer, KafkaProducer
from kafka.errors import NoBrokersAvailable


BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
INPUT_TOPIC = os.getenv("KAFKA_INPUT_TOPIC", "sensors.raw")
OUTPUT_TOPIC = os.getenv("KAFKA_OUTPUT_TOPIC", "sensors.crypto")
POLICY_REQUEST_TOPIC = os.getenv("KAFKA_POLICY_REQUEST_TOPIC", "policy.requests")
POLICY_DECISION_TOPIC = os.getenv("KAFKA_POLICY_DECISION_TOPIC", "policy.decisions")
GROUP_ID = os.getenv("KAFKA_GROUP_ID", "crypto-gateway")
CRYPTO_KEY = os.environ["CRYPTO_KEY"].encode("utf-8")


class MessageTypeStrategy:
    def detect(self, payload: dict) -> str:
        if "temperature" in payload or "humidity" in payload:
            return "sensor-data"
        return "text-message"


class CryptoContainerFacade:
    def __init__(self, key: bytes):
        self.fernet = Fernet(key)

    def seal(self, payload: dict, policy_decision: dict) -> dict:
        plaintext = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        token = self.fernet.encrypt(plaintext).decode("utf-8")
        return {
            "container_version": "1.0",
            "algorithm": "Fernet(AES-128-CBC-HMAC-SHA256)",
            "ciphertext": token,
            "policy": {
                "decision": policy_decision["decision"],
                "policy_version": policy_decision["policy_version"],
                "decided_at": policy_decision["decided_at"],
            },
            "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }


def connect() -> tuple[KafkaConsumer, KafkaConsumer, KafkaProducer]:
    for attempt in range(1, 31):
        try:
            raw_consumer = KafkaConsumer(
                INPUT_TOPIC,
                bootstrap_servers=BOOTSTRAP_SERVERS,
                group_id=GROUP_ID,
                auto_offset_reset="earliest",
                enable_auto_commit=True,
                value_deserializer=lambda raw: json.loads(raw.decode("utf-8")),
            )
            decision_consumer = KafkaConsumer(
                POLICY_DECISION_TOPIC,
                bootstrap_servers=BOOTSTRAP_SERVERS,
                group_id=f"{GROUP_ID}-decisions-{uuid.uuid4()}",
                auto_offset_reset="earliest",
                enable_auto_commit=True,
                value_deserializer=lambda raw: json.loads(raw.decode("utf-8")),
                consumer_timeout_ms=1000,
            )
            producer = KafkaProducer(
                bootstrap_servers=BOOTSTRAP_SERVERS,
                value_serializer=lambda value: json.dumps(value, ensure_ascii=False).encode("utf-8"),
                acks="all",
                retries=5,
            )
            return raw_consumer, decision_consumer, producer
        except NoBrokersAvailable:
            print(f"Kafka is starting, attempt {attempt}/30...")
            time.sleep(2)
    raise RuntimeError("Could not connect to Kafka")


def wait_for_decision(consumer: KafkaConsumer, request_id: str, timeout_seconds: int = 10) -> dict | None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        records = consumer.poll(timeout_ms=500)
        for messages in records.values():
            for message in messages:
                decision = message.value
                if decision.get("request_id") == request_id:
                    return decision
    return None


def main() -> None:
    raw_consumer, decision_consumer, producer = connect()
    classifier = MessageTypeStrategy()
    crypto = CryptoContainerFacade(CRYPTO_KEY)
    print(f"Crypto gateway started: {INPUT_TOPIC} -> policy -> {OUTPUT_TOPIC}")

    try:
        for message in raw_consumer:
            payload = message.value
            request_id = str(uuid.uuid4())
            request = {
                "request_id": request_id,
                "message_type": classifier.detect(payload),
                "payload": payload,
                "requested_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            }
            producer.send(POLICY_REQUEST_TOPIC, value=request).get(timeout=15)
            decision = wait_for_decision(decision_consumer, request_id)
            if not decision:
                print(f"DROP policy_timeout request_id={request_id}")
                continue
            if decision["decision"] != "allow":
                print(f"DROP policy_denied {json.dumps(decision, ensure_ascii=False)}")
                continue

            container = crypto.seal(payload, decision)
            producer.send(OUTPUT_TOPIC, value=container).get(timeout=15)
            print(f"SEALED -> request_id={request_id} topic={OUTPUT_TOPIC}")
    finally:
        raw_consumer.close()
        decision_consumer.close()
        producer.close()


if __name__ == "__main__":
    main()
