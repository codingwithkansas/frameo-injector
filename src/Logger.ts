import PinoSDK from 'pino';

const logger = PinoSDK({
    level: 'debug',
    formatters: {
        level: (label: string) => {
            return {
                level: label
            }
        }
    },
});

export default logger;