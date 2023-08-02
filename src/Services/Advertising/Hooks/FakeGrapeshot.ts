import IAdvertisingLifecycleHook from "../IAdvertisingLifecycleHook";

export default class FakeGrapeshot implements IAdvertisingLifecycleHook {

    // just a fake keyvalue provider like grapeshot, with a random resolve time 0ms to 400ms
    // the GRAAAAAAPEEEEEEESHOOOOOOOOOOOTTTTTTTTTT is here so you can easy spot it in the adcall payload (use browser network tab filtering with "ads?")
    handleGetExternalKeyvalues(): Promise<Record<string, string>> {
        return new Promise(resolve => setTimeout(() => resolve({
            GRAAAAAAPEEEEEEESHOOOOOOOOOOOTTTTTTTTTT: Math.random().toString(),
            TOTO: 'titi',
        }), Math.floor(Math.random()*400)));
    }
}
