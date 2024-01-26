import { auth, drive } from "@googleapis/drive";
import { createWriteStream } from 'fs';
import * as ReadlineSDK from 'node:readline';
import { readFileSync } from "fs";

const Readline = ReadlineSDK.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const askQuestion = (question: string): Promise<string> => new Promise((resolve) => {
    Readline.question(question, answer => {
        resolve(answer);
    });
})

export interface GoogleDriveOptions {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

export interface GoogleDriveToken {
    access_token: string;
    refresh_token: string;
    scope: string;
    token_type: string;
    expiry_date: number;
}

export default class GoogleDrive {
    private readonly options: GoogleDriveOptions;
    private readonly SCOPES: string[] = ['https://www.googleapis.com/auth/drive'];
    private readonly oauth2Client: any;
    private readonly client: any;

    constructor(options: GoogleDriveOptions, keyFile?: string | (Omit<GoogleDriveToken, 'scope'>)) {
        this.options = options;
        this.oauth2Client = new auth.OAuth2(
            options.clientId,
            options.clientSecret,
            options.redirectUri
        );
        if (keyFile) {
            if (typeof keyFile === 'string') {
                const keyFileBody = readFileSync(keyFile).toString('utf-8');
                this.oauth2Client.setCredentials(JSON.parse(keyFileBody));
            } else {
                this.oauth2Client.setCredentials({...keyFile, scope: this.SCOPES[0]});
            }
        }
        this.client = drive({
            version: 'v2',
            auth: this.oauth2Client
        });
    }

    doLogin = async () => {
        console.log(`Starting Google Credentials Generation`);
        // generate a url that asks permissions for Google Drive scopes
        const url = this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: this.SCOPES
        });
        console.log(`\t1. Navigate to the following URL\n\t2. Login with your chosen account\n\t3. Allow the OAuth client\n\t4. Copy the full redirect url and return to CLI`);
        console.log(`\n\tURL: ${url}`);
        
        let authCode: string | undefined;
        while (!authCode) {
            const redirectUrl = await askQuestion('Redirect URL: ');
            try {
                const searchParamSplit = redirectUrl.split('?');
                if (!searchParamSplit || searchParamSplit.length < 2) {
                    console.error(`Invalid URL was given: no querystring params were found`);
                    continue;
                }
                authCode = new URLSearchParams(searchParamSplit[1]).get('code');
            } catch (err) {
                console.error(`Unable to extract code from the given URL`, err);
                authCode = undefined;
            }
        }

        const freshToken = await this.oauth2Client.getToken(authCode);
        console.log(`Extracted fresh tokens: ${JSON.stringify(freshToken.tokens || freshToken)}`);
    }

    downloadFile = (googleFile, destPath: string): Promise<string> => {
        const self = this;
        return new Promise((resolve, reject) => {
            const dest = createWriteStream(destPath);
            self.client.files.get(
                {fileId: googleFile.id, alt: "media"},
                {responseType: "stream"},
                (err, {data}) => {
                    if (err) {
                        return reject(err);
                    }
                    data
                        .on("end", () => {
                            return resolve(destPath);
                        })
                        .on("error", (err) => {
                            return reject(err);
                        })
                        .pipe(dest);
                }
            );
        })
    };

    listFiles = (query: string) => {
        return this.client.files.list({
            q: query
        });
    }
}
