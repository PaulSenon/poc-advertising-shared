export default interface IService {
    init(): Promise<void>; // async init called right after service instantiation
    reset():Promise<void>; // called between SPA page change
}