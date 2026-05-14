#!/usr/bin/env python3
import json
import os
import time

from kafka import KafkaConsumer
from kafka.errors import NoBrokersAvailable


BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
TOPICS = [topic.strip() for topic in os.getenv("KAFKA_TOPICS", "messages.filtered,sensors.data.filtered").split(",")]
GROUP_ID = os.getenv("KAFKA_GROUP_ID", "secure-viewer")


def connect_with_retry() -> KafkaConsumer:
    for attempt in range(1, 31):
        try:
            return KafkaConsumer(
                *TOPICS,
                bootstrap_servers=BOOTSTRAP_SERVERS,
                group_id=GROUP_ID,
                auto_offset_reset="earliest",
                enable_auto_commit=True,
                value_deserializer=lambda raw: json.loads(raw.decode("utf-8")),
            )
        except NoBrokersAvailable:
            print(f"Kafka is starting, attempt {attempt}/30...")
            time.sleep(2)
    raise RuntimeError("Could not connect to Kafka")


def main() -> None:
    print("=" * 64)
    print("Kafka consumer: filtered chat and sensor viewer")
    print("=" * 64)
    print(f"Broker: {BOOTSTRAP_SERVERS}")
    print(f"Topics: {TOPICS}")
    print("-" * 64)

    consumer = connect_with_retry()
    count = 0
    try:
        for message in consumer:
            count += 1
            payload = message.value
            print(f"\nMessage #{count}")
            print(f"topic={message.topic}, partition={message.partition}, offset={message.offset}")
            print(json.dumps(payload, ensure_ascii=False, indent=2))
    finally:
        consumer.close()


if __name__ == "__main__":
    main()
