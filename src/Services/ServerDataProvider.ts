import { AdvertisingConfig } from "./Advertising/Advertising";

export default class ServerDataProvider {
    private advertisingData?: AdvertisingConfig;
    private static _instance: ServerDataProvider;

    public static getInstance(): ServerDataProvider {
        if(!ServerDataProvider._instance) {
            ServerDataProvider._instance = new ServerDataProvider();
        }
        return ServerDataProvider._instance;
    }

    public getAdvertisingData(): AdvertisingConfig | undefined {
        if (this.advertisingData) return this.advertisingData;
        
        const metaAdvertisingData: HTMLMetaElement | null = document.head.querySelector("meta[name=advertising-data]");
        if (!metaAdvertisingData) {
            return;
        }
        this.advertisingData = JSON.parse(metaAdvertisingData.content);
        // TODO check config structure
        return this.advertisingData;
    }

    public setServerData(data: {advertisingData: AdvertisingConfig}): void {
        this.advertisingData = data.advertisingData;
    }
}