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
INPUT_TOPICS = [topic.strip() for topic in os.getenv("KAFKA_INPUT_TOPICS", "messages.raw,sensors.raw").split(",")]
CHAT_OUTPUT_TOPIC = os.getenv("KAFKA_CHAT_OUTPUT_TOPIC", "messages.crypto")
SENSOR_OUTPUT_TOPIC = os.getenv("KAFKA_SENSOR_OUTPUT_TOPIC", "sensors.crypto")
POLICY_REQUEST_TOPIC = os.getenv("KAFKA_POLICY_REQUEST_TOPIC", "policy.requests")
POLICY_DECISION_TOPIC = os.getenv("KAFKA_POLICY_DECISION_TOPIC", "policy.decisions")
GROUP_ID = os.getenv("KAFKA_GROUP_ID", "crypto-gateway")
CRYPTO_KEY = os.environ["CRYPTO_KEY"].encode("utf-8")


class MessageTypeStrategy:
    def detect(self, payload: dict, source_topic: str) -> str:
        if source_topic.startswith("sensors.") or "temperature" in payload or "humidity" in payload:
            return "sensor-data"
        return "chat-message"


class CryptoContainerFacade:
    def __init__(self, key: bytes):
        self.fernet = Fernet(key)

    def seal(self, payload: dict, policy_decision: dict, message_type: str, source_topic: str) -> dict:
        plaintext = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        token = self.fernet.encrypt(plaintext).decode("utf-8")
        return {
            "container_version": "1.0",
            "message_type": message_type,
            "source_topic": source_topic,
            "algorithm": "Fernet(AES-128-CBC-HMAC-SHA256)",
            "ciphertext": token,
            "policy": {
                "decision": policy_decision["decision"],
                "policy_version": policy_decision["policy_version"],
                "decided_at": policy_decision["decided_at"],
            },
            "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }


def output_topic_for(message_type: str) -> str:
    if message_type == "sensor-data":
        return SENSOR_OUTPUT_TOPIC
    return CHAT_OUTPUT_TOPIC


def connect() -> tuple[KafkaConsumer, KafkaConsumer, KafkaProducer]:
    for attempt in range(1, 31):
        try:
            raw_consumer = KafkaConsumer(
                *INPUT_TOPICS,
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
    print(f"Crypto gateway started: {INPUT_TOPICS} -> policy -> crypto topics")

    try:
        for message in raw_consumer:
            payload = message.value
            message_type = classifier.detect(payload, message.topic)
            request_id = str(uuid.uuid4())
            request = {
                "request_id": request_id,
                "message_type": message_type,
                "payload": payload,
                "source_topic": message.topic,
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

            container = crypto.seal(payload, decision, message_type, message.topic)
            output_topic = output_topic_for(message_type)
            producer.send(output_topic, value=container).get(timeout=15)
            print(f"SEALED -> request_id={request_id} type={message_type} topic={output_topic}")
    finally:
        raw_consumer.close()
        decision_consumer.close()
        producer.close()


if __name__ == "__main__":
    main()
