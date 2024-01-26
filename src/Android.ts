import { createClient as createADBClient, Client, Device } from '@u4/adbkit';
import {Readable} from 'stream';
import Logger from './Logger';

export interface AdbAdapterOptions {
    adbServerHost: string;
    adbServerPort: number;
}

export class AdbAdapter {
    private readonly client: Client = createADBClient();
    private host: string;

    constructor(options: AdbAdapterOptions) {
        this.host = `${options.adbServerHost}:${options.adbServerPort}`;
    }

    private connectToClient = async () => {
        return this.client.connect(this.host);
    }

    private disconnect = async (deviceId: string) => {
        return this.client.disconnect(deviceId);
    }

    withClient = async (fn: (device: Device) => Promise<void>) => {
        await this.connectToClient();
        let deviceId;
        try {
            const devices = await this.client.listDevices();
            for (const device of devices) {
                deviceId = device.id;
                Logger.info(`Connected to client ${device}`);
                await fn(device);
            }
        } catch (err) {
            Logger.error(`An error occurred with ADB client`, err);
        } finally {
            if (deviceId) {
                Logger.info(`Disconnecting from ADB server: ${deviceId}`);
                this.disconnect(deviceId)
                Logger.info(`Disconnected from ADB server: ${deviceId}`);
            }
        }
    }

    pushStream = async (stream: Readable, path: string, device: Device) => {
        Logger.debug(`Pushing stream to path: ${path}`);
        try {
            const deviceClient = device.getClient();
            const sync = await deviceClient.syncService();
            const transfer = await sync.pushStream(stream, path);
            transfer.on('progress', (stats) =>
                Logger.debug(`[${device.id}] Pushed ${stats.bytesTransferred} bytes so far`),
            );
            transfer.on('end', () => {
                Logger.debug(`[${device.id}] Push complete`);
            });
            await new Promise((resolve, reject) => {
                transfer.on('error', (err) => {
                    Logger.error('Unable to push file:', err.stack);
                    reject(err);
                });
                transfer.waitForEnd().finally(() => {
                    Logger.debug(`[${device.id}] Push complete`);
                    sync.end();
                    resolve(null);
                })
            })
            Logger.info(`Completed pushing stream to path: ${path}`);
        } catch (err) {
            Logger.error('Something went wrong:', err.stack);
        }
    }

    runShell = async (command: string, device: Device) => {
        try {
            Logger.info(`Running shell "${command}" on device: "${device.id}"`);
            const deviceClient = device.getClient();
            return await deviceClient.execOut(command, 'utf8');
        } catch (err) {
            Logger.error('Something went wrong:', err.stack);
        }
    }
}
