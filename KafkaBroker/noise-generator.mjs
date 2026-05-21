import { Kafka } from "kafkajs";
import { createCryptoContainer } from "./crypto.mjs";

const brokers = (process.env.KAFKA_BROKERS || "localhost:9092").split(",");
const topic = process.env.KAFKA_NOISE_TOPIC || "cryptobroker.noise.raw";
const kafka = new Kafka({ clientId: "cryptobroker-noise-generator", brokers });
const producer = kafka.producer();

const noiseKinds = [
  "heartbeat",
  "duplicate-message",
  "malformed-payload",
  "unknown-sender",
  "oversized-message",
  "policy-denied",
  "sensor-jitter",
  "spam-burst",
];

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomText(kind, counter) {
  const samples = {
    "heartbeat": `service heartbeat ${counter}`,
    "duplicate-message": `duplicate payload candidate ${counter}`,
    "malformed-payload": `broken frame $$${Math.random().toString(16).slice(2)}`,
    "unknown-sender": `message from unknown sender ${counter}`,
    "oversized-message": "x".repeat(200 + Math.floor(Math.random() * 400)),
    "policy-denied": `policy denied test event ${counter}`,
    "sensor-jitter": `temperature=${(20 + Math.random() * 20).toFixed(2)} humidity=${(35 + Math.random() * 40).toFixed(2)}`,
    "spam-burst": `spam burst packet ${counter}`,
  };
  return samples[kind] || `noise event ${counter}`;
}

function createNoiseEvent(counter) {
  const kind = pick(noiseKinds);
  const createdAt = new Date().toISOString();
  const metadata = {
    eventId: `noise_${Date.now().toString(36)}_${counter}`,
    kind,
    source: "noise-generator",
    createdAt,
    severity: pick(["low", "medium", "high"]),
  };

  return {
    eventType: "noise.generated",
    createdAt,
    noiseKind: kind,
    cryptoContainer: createCryptoContainer(randomText(kind, counter), metadata),
  };
}

async function main() {
  await producer.connect();
  let counter = 1;
  console.log(`noise generator started: ${topic}`);

  while (true) {
    const event = createNoiseEvent(counter);
    await producer.send({
      topic,
      messages: [
        {
          key: event.noiseKind,
          value: JSON.stringify(event),
        },
      ],
    });
    console.log(`noise ${counter}: ${event.noiseKind}`);
    counter += 1;
    await new Promise((resolve) => setTimeout(resolve, 2000 + Math.floor(Math.random() * 3000)));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
