declare namespace NodeJS {
    interface ProcessEnv {
        readonly FIGMA_TOKEN: string;
        readonly WEB_TYPOGRAPHY_FILE_KEYS: string;
        readonly IOS_TYPOGRAPHY_FILE_KEYS: string;
        readonly ANDROID_TYPOGRAPHY_FILE_KEYS: string;
    }
}
