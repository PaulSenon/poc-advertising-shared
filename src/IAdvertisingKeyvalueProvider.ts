export default interface IAdvertisingKeyvalueProvider {
    getAdvertisingKvKey(): string;
    getAdvertisingKvValue(): Promise<string>;
}