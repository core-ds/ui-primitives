export type MetaInfo = {
    description: string;
    middle: string;
    web?: string;
    webComponent?: string;
    android?: string;
    ios?: string;
    cdn?: string;
    url?: string;
};

export type MetaOptions = Exclude<keyof MetaInfo, 'description' | 'basename'>;
