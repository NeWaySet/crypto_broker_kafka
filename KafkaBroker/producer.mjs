import { Kafka } from "kafkajs";
import { createCryptoContainer } from "./crypto.mjs";

const brokers = (process.env.KAFKA_BROKERS || "localhost:9092").split(",");
const topic = process.env.KAFKA_TOPIC || "cryptobroker.messages.crypto";
const kafka = new Kafka({ clientId: "cryptobroker-producer", brokers });
const producer = kafka.producer();

function createEvent(text) {
  const messageId = `msg_${Date.now().toString(36)}`;
  const createdAt = new Date().toISOString();
  const metadata = {
    messageId,
    chatId: "kafka_demo_chat",
    senderId: "kafka_demo_user",
    createdAt,
    transport: "kafka",
  };
  return {
    eventId: `evt_${Date.now().toString(36)}`,
    eventType: "message.created",
    createdAt,
    cryptoContainer: createCryptoContainer(text, metadata),
  };
}

async function send(text) {
  await producer.connect();
  const event = createEvent(text);
  await producer.send({
    topic,
    messages: [
      {
        key: event.cryptoContainer.metadata.chatId,
        value: JSON.stringify(event),
      },
    ],
  });
  console.log(`sent ${event.eventId} to ${topic}`);
  await producer.disconnect();
}

async function loop() {
  await producer.connect();
  let counter = 1;
  while (true) {
    const event = createEvent(`Kafka crypto message #${counter}`);
    await producer.send({
      topic,
      messages: [{ key: event.cryptoContainer.metadata.chatId, value: JSON.stringify(event) }],
    });
    console.log(`sent ${event.eventId}: Kafka crypto message #${counter}`);
    counter += 1;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

const manualText = process.argv.slice(2).join(" ").trim();
if (manualText) {
  send(manualText).catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else {
  loop().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
