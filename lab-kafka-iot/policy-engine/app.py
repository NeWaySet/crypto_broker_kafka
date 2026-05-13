#!/usr/bin/env python3
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

from kafka import KafkaConsumer, KafkaProducer
from kafka.errors import NoBrokersAvailable


BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
INPUT_TOPIC = os.getenv("KAFKA_INPUT_TOPIC", "policy.requests")
OUTPUT_TOPIC = os.getenv("KAFKA_OUTPUT_TOPIC", "policy.decisions")
GROUP_ID = os.getenv("KAFKA_GROUP_ID", "policy-engine")
POLICY_FILE = Path(os.getenv("POLICY_FILE", "/policy/policy.json"))


class PolicyDecisionPoint:
    def __init__(self, policy: dict):
        self.policy = policy

    def decide(self, request: dict) -> dict:
        payload = request.get("payload", {})
        message_type = request.get("message_type")
        reasons = []

        if payload.get("source") not in self.policy["allowed_sources"]:
            reasons.append("source_not_allowed")
        if message_type not in self.policy["allowed_message_types"]:
            reasons.append("message_type_not_allowed")

        text = str(payload.get("text", ""))
        if len(text) > self.policy["limits"]["max_text_length"]:
            reasons.append("text_too_long")

        if message_type == "sensor-data":
            try:
                temperature = float(payload["temperature"])
                humidity = float(payload["humidity"])
            except (KeyError, TypeError, ValueError):
                reasons.append("invalid_sensor_schema")
            else:
                limits = self.policy["limits"]
                if not limits["temperature_min"] <= temperature <= limits["temperature_max"]:
                    reasons.append("temperature_out_of_range")
                if not limits["humidity_min"] <= humidity <= limits["humidity_max"]:
                    reasons.append("humidity_out_of_range")

        decision = "allow" if not reasons else self.policy["default_decision"]
        return {
            "request_id": request["request_id"],
            "decision": decision,
            "reasons": reasons,
            "policy_version": self.policy["version"],
            "decided_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }


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
    policy = json.loads(POLICY_FILE.read_text(encoding="utf-8"))
    pdp = PolicyDecisionPoint(policy)
    consumer, producer = connect()
    print(f"Policy engine started: {INPUT_TOPIC} -> {OUTPUT_TOPIC}")
    try:
        for message in consumer:
            decision = pdp.decide(message.value)
            producer.send(OUTPUT_TOPIC, value=decision).get(timeout=15)
            print(f"DECISION -> {json.dumps(decision, ensure_ascii=False)}")
    finally:
        consumer.close()
        producer.close()


if __name__ == "__main__":
    main()
