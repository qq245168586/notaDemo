import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { MongoClient } from 'mongodb';
import { appConfig } from '../src/config/ai';

async function main() {
  const direct = new MongoClient('mongodb://127.0.0.1:27017/?directConnection=true', { serverSelectionTimeoutMS: 2000 });
  try {
    await direct.db('admin').command({ ping: 1 });
  } catch {
    await direct.close();
    const directory = path.join(appConfig.dataDir, 'mongodb');
    fs.mkdirSync(directory, { recursive: true });
    const result = spawnSync(process.env.MONGOD_PATH ?? '/opt/homebrew/opt/mongodb-community@8.0/bin/mongod',
      ['--dbpath', directory, '--bind_ip', '127.0.0.1', '--port', '27017', '--replSet', 'nota-rs', '--fork', '--logpath', path.join(directory, 'mongod.log')], { stdio: 'inherit' });
    if (result.status !== 0) throw new Error('MongoDB 启动失败，请先安装 MongoDB 或设置 MONGOD_PATH');
  }
  const client = new MongoClient('mongodb://127.0.0.1:27017/?directConnection=true');
  try {
    try { await client.db('admin').command({ replSetGetStatus: 1 }); }
    catch (error) {
      if ((error as { code?: number }).code !== 94) throw error;
      await client.db('admin').command({ replSetInitiate: { _id: 'nota-rs', members: [{ _id: 0, host: '127.0.0.1:27017' }] } });
    }
    for (let attempt = 0; attempt < 30; attempt++) {
      if ((await client.db('admin').command({ hello: 1 })).isWritablePrimary) {
        console.log('MongoDB 已就绪：127.0.0.1:27017，单节点副本集 nota-rs'); return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('等待 MongoDB 主节点超时');
  } finally { await direct.close(); await client.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
