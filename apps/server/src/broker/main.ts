import { createBroker } from 'aedes';
import net from 'node:net';
import { appConfig } from '@/config/ai';

const broker = createBroker();
const server = net.createServer(broker.handle);

server.listen(appConfig.mqttPort, '0.0.0.0', () => {
  console.log(`Nota MQTT Broker 已启动: mqtt://127.0.0.1:${appConfig.mqttPort}`);
});

broker.on('client', (client) => console.log(`MQTT客户端连接: ${client?.id}`));
broker.on('clientDisconnect', (client) => console.log(`MQTT客户端断开: ${client?.id}`));
