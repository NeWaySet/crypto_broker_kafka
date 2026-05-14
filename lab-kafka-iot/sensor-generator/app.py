#!/usr/bin/env python3
import json
import os
import random
import time
from datetime import datetime, timezone

from kafka import KafkaProducer
from kafka.errors import NoBrokersAvailable


BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
SENSOR_TOPIC = os.getenv("KAFKA_SENSOR_TOPIC", "sensors.raw")
SENSOR_ID = os.getenv("SENSOR_ID", "auto-sensor-1")
INTERVAL_SECONDS = float(os.getenv("INTERVAL_SECONDS", "4"))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect_with_retry() -> KafkaProducer:
    for attempt in range(1, 31):
        try:
            return KafkaProducer(
                bootstrap_servers=BOOTSTRAP_SERVERS,
                value_serializer=lambda value: json.dumps(value, ensure_ascii=False).encode("utf-8"),
                acks="all",
                retries=5,
            )
        except NoBrokersAvailable:
            print(f"Kafka is starting, attempt {attempt}/30...")
            time.sleep(2)
    raise RuntimeError("Could not connect to Kafka")


def next_reading(previous_temperature: float, previous_humidity: float) -> tuple[float, float]:
    temperature = previous_temperature + random.uniform(-0.4, 0.4)
    humidity = previous_humidity + random.uniform(-1.2, 1.2)
    return round(max(18.0, min(29.0, temperature)), 1), round(max(30.0, min(70.0, humidity)), 1)


def main() -> None:
    producer = connect_with_retry()
    temperature = random.uniform(21.0, 25.0)
    humidity = random.uniform(38.0, 52.0)

    print(f"Sensor generator started: {SENSOR_ID} -> {SENSOR_TOPIC}")
    while True:
        temperature, humidity = next_reading(temperature, humidity)
        payload = {
            "kind": "sensor",
            "sensor_id": SENSOR_ID,
            "temperature": temperature,
            "humidity": humidity,
            "source": "sensor-generator",
            "timestamp": now_iso(),
        }
        metadata = producer.send(SENSOR_TOPIC, value=payload).get(timeout=15)
        print(f"SENSOR -> topic={SENSOR_TOPIC} offset={metadata.offset} {json.dumps(payload, ensure_ascii=False)}")
        time.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
