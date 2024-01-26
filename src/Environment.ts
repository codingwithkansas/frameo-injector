const EnvironmentVariables = (constructor, descriptor) => {
    for (const [key, value] of Object.entries(process.env)) {
        constructor[key] = value || constructor[key] || null;
    }
    return constructor;
}

@EnvironmentVariables
export default class Environment {
    static GOOGLE_OAUTH2_CLIENT_ID: string | null;
    static GOOGLE_OAUTH2_CLIENT_SECRET: string | null;
    static GOOGLE_OAUTH2_CLIENT_REDIRECT_URI: string | null;
    static GOOGLE_OAUTH2_ACCESS_TOKEN: string | null;
    static GOOGLE_OAUTH2_REFRESH_TOKEN: string | null; 
    static GOOGLE_OAUTH2_TOKEN_EXPIRY: string | null; 
    static GOOGLE_DRIVE_FOLDER_ID: string | null;
    static REMOTE_DEVICE_HOST: string | null;
    static REMOTE_DEVICE_ADBPORT: string | null;
    static REMOTE_DEVICE_PATH: string | null;
}