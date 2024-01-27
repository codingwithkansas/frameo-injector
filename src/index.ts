import './tracing.js';
import * as fs from 'fs';
import * as convert from 'heic-convert'
import Environment from './Environment';
import GoogleDrive from './GoogleDrive.js';
import { AdbAdapter } from './Android.js';
import { Device } from '@u4/adbkit';
import Logger from './Logger';

const replicateTask = async (overwriteFiles: boolean) => {
    try {
        if (!Environment.GOOGLE_OAUTH2_REFRESH_TOKEN) {
            Logger.error(`Google credentials token env vars are missing or empty`);
            throw new Error(`Google credentials token env vars are missing or empty`);
        }
        const oauthClientCreds = {
            clientId: Environment.GOOGLE_OAUTH2_CLIENT_ID,
            clientSecret: Environment.GOOGLE_OAUTH2_CLIENT_SECRET,
            redirectUri: Environment.GOOGLE_OAUTH2_CLIENT_REDIRECT_URI
        };
        const cachedTokens = {
            refresh_token: Environment.GOOGLE_OAUTH2_REFRESH_TOKEN,
            access_token: Environment.GOOGLE_OAUTH2_ACCESS_TOKEN,
            token_type: 'Bearer',
            expiry_date: parseInt(Environment.GOOGLE_OAUTH2_TOKEN_EXPIRY)
        };
        const googleDrive = new GoogleDrive(oauthClientCreds, cachedTokens);
        const adapter = new AdbAdapter({
            adbServerHost: Environment.REMOTE_DEVICE_HOST,
            adbServerPort: parseInt(Environment.REMOTE_DEVICE_ADBPORT)
        })

        let ID_OF_THE_FOLDER = Environment.GOOGLE_DRIVE_FOLDER_ID;
        await googleDrive.listFiles(`'${ID_OF_THE_FOLDER}' in parents and trashed=false`, async (items) => {
            await adapter.withClient(async (device: Device) => {
                Logger.info({external_google_folder_id: ID_OF_THE_FOLDER}, `Retrieved ${items.length} items from Google Drive`);
                for (const file of items) {
                    Logger.info({external_google_folder_id: ID_OF_THE_FOLDER, external_file: file.title, external_file_md5: file.md5Checksum},
                        `Analyzing file ${file.title} with checksum: ${file.md5Checksum}`);
                    let shouldPush = true;
                    const outputFileName = file.title.toLowerCase().includes('heic')
                        ? file.title.toLowerCase().replace('.heic', '.jpg')
                        : file.title;
                    const outputFilePath = `${Environment.REMOTE_DEVICE_PATH}${outputFileName}`;
                    if (!overwriteFiles) {
                        let existingChecksum = await adapter.runShell(`md5sum ${outputFilePath}`, device);
                        if (existingChecksum && !existingChecksum.toLowerCase().includes('no such file or directory')) {
                            if (existingChecksum.split(' ')[0] === file.md5Checksum) {
                                Logger.info({
                                    external_google_folder_id: ID_OF_THE_FOLDER, 
                                    external_file: file.title, 
                                    external_file_md5: file.md5Checksum,
                                    device_file_path: outputFilePath,
                                    device_file_md5: existingChecksum
                                }, `Found existing file with matching checksum: ${existingChecksum}`);
                                shouldPush = false;
                            } else {
                                Logger.info({
                                    external_google_folder_id: ID_OF_THE_FOLDER, 
                                    external_file: file.title, 
                                    external_file_md5: file.md5Checksum,
                                    device_file_path: outputFilePath,
                                    device_file_md5: existingChecksum
                                }, `Found existing file with mismatching checksum: ${existingChecksum}`);
                            }
                        } else {
                            Logger.info({
                                external_google_folder_id: ID_OF_THE_FOLDER, 
                                external_file: file.title, 
                                external_file_md5: file.md5Checksum,
                                device_file_path: outputFilePath
                            }, `Existing file was not found`);
                        }
                    }
                    
                    if (!shouldPush) {
                        Logger.info({
                            external_google_folder_id: ID_OF_THE_FOLDER, 
                            external_file: file.title, 
                            external_file_md5: file.md5Checksum,
                            device_file_path: outputFileName
                        }, `Skipping file`);
                        continue;
                    }
                    
                    const tmpFilePath = `/tmp/google-${file.title}`;
                    Logger.info({
                        external_google_folder_id: ID_OF_THE_FOLDER, 
                        external_file: file.title, 
                        external_file_md5: file.md5Checksum,
                        device_file_path: outputFilePath,
                        localtmp_file_path: tmpFilePath
                    }, `Downloading image to temporary storage`);
                    const tmpFile = await googleDrive.downloadFile(file, tmpFilePath);
                    if ('heic' === file.fileExtension.toLowerCase()) {
                        try {
                            Logger.info({
                                external_google_folder_id: ID_OF_THE_FOLDER, 
                                external_file: file.title, 
                                external_file_md5: file.md5Checksum,
                                device_file_path: outputFilePath,
                                localtmp_file_path: tmpFilePath
                            }, `Converting HEIC to JPEG`);
                            const outputBuffer = await convert({
                                buffer: fs.readFileSync(tmpFile),    // the HEIC file buffer
                                format: 'JPEG',      // output format
                                quality: 1           // the jpeg compression quality, between 0 and 1
                            });
                            Logger.info({
                                external_google_folder_id: ID_OF_THE_FOLDER, 
                                external_file: file.title, 
                                external_file_md5: file.md5Checksum,
                                device_file_path: outputFilePath,
                                localtmp_file_path: tmpFilePath
                            }, `Pushing converted file to ADB device`);
                            await adapter.pushStream(outputBuffer, outputFilePath, device);
                        } catch (err) {
                            Logger.error({
                                external_google_folder_id: ID_OF_THE_FOLDER, 
                                external_file: file.title, 
                                external_file_md5: file.md5Checksum,
                                device_file_path: outputFilePath,
                                localtmp_file_path: tmpFilePath
                            }, `Unable to convert HEIC file.`, err.stack);
                            if (err.message.includes('input buffer is not a HEIC image')) {
                                Logger.warn({
                                    external_google_folder_id: ID_OF_THE_FOLDER, 
                                    external_file: file.title, 
                                    external_file_md5: file.md5Checksum,
                                    device_file_path: outputFilePath,
                                    localtmp_file_path: tmpFilePath
                                }, `File was not a proper HEIC image. Attempting to save as JPG.`);
                                Logger.info({
                                    external_google_folder_id: ID_OF_THE_FOLDER, 
                                    external_file: file.title, 
                                    external_file_md5: file.md5Checksum,
                                    device_file_path: outputFilePath,
                                    localtmp_file_path: tmpFilePath
                                }, `Pushing file to ADB device`);
                                await adapter.pushStream(fs.createReadStream(tmpFile), outputFilePath, device);
                            }
                        }
                    } else {
                        Logger.info({
                            external_google_folder_id: ID_OF_THE_FOLDER, 
                            external_file: file.title, 
                            external_file_md5: file.md5Checksum,
                            device_file_path: outputFilePath,
                            localtmp_file_path: tmpFilePath
                        }, `Pushing file to ADB device`);
                        await adapter.pushStream(fs.createReadStream(tmpFile), outputFilePath, device);
                    }
                }
            });
        });
        process.exit(0);
    } catch (err) {
        Logger.error(`Something went wrong: ${err.message} ${err.stack}`, err.stack);
        throw err;
    }
}

const doGoogleLogin = async () => {
    const googleDrive = new GoogleDrive({
        clientId: Environment.GOOGLE_OAUTH2_CLIENT_ID,
        clientSecret: Environment.GOOGLE_OAUTH2_CLIENT_SECRET,
        redirectUri: Environment.GOOGLE_OAUTH2_CLIENT_REDIRECT_URI
    });
    await googleDrive.doLogin();
    process.exit(0);
}

const task = process.argv[process.argv.length - 1];
if (task === 'replicate') {
    replicateTask(false)
} else if (task === 'replicate-overwrite') {
    replicateTask(true);
} else if (task === 'google-login') {
    doGoogleLogin();
} else {
    Logger.error(`Invalid start task '${task}', expecting 'replicate' or 'replicate-overwrite' or 'google-login'`);
}