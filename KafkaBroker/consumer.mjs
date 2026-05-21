import { mkdir, appendFile } from "node:fs/promises";
import { join } from "node:path";
import { Kafka } from "kafkajs";
import { decryptCryptoContainer } from "./crypto.mjs";

const brokers = (process.env.KAFKA_BROKERS || "localhost:9092").split(",");
const topic = process.env.KAFKA_TOPIC || "cryptobroker.messages.crypto";
const kafka = new Kafka({ clientId: "cryptobroker-consumer", brokers });
const consumer = kafka.consumer({ groupId: "cryptobroker-audit-log" });
const logDir = join(process.cwd(), "logs");
const logPath = join(logDir, "messages.jsonl");

async function main() {
  await mkdir(logDir, { recursive: true });
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: true });
  console.log(`consumer subscribed to ${topic}`);

  await consumer.run({
    eachMessage: async ({ message }) => {
      const raw = message.value?.toString("utf8") || "{}";
      const event = JSON.parse(raw);
      const text = decryptCryptoContainer(event.cryptoContainer);
      const auditRecord = {
        receivedAt: new Date().toISOString(),
        eventId: event.eventId,
        eventType: event.eventType,
        topic,
        key: message.key?.toString("utf8") || "",
        metadata: event.cryptoContainer.metadata,
        decryptedText: text,
      };
      await appendFile(logPath, `${JSON.stringify(auditRecord)}\n`, "utf8");
      console.log(`received ${event.eventId}: ${text}`);
    },
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
