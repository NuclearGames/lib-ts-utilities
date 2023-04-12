/**
 * Словарь: имя сервиса - адрес сервиса.
 * Адреса без http://.
 */
export class ArpServiceMapSettings {
    private readonly _map: Map<string, string>;

    constructor(map : Map<string, string>) {
        // Перекладываем в мапу, выбрасывая http:// из адреса.
        this._map = new Map<string, string>();
        for(const [key, value] of map) {
            this._map.set(key, value.substring(value.lastIndexOf("/") + 1));
        }
    }

    public get map() : ReadonlyMap<string, string> {
        return this._map;
    }

    /**
     * Возвращает адрес сервиса.
     * Если его нет - выбрасывает исключение.
     * @param serviceId 
     * @returns 
     */
    public getRequiredServiceHost(serviceId: string) : string {
        const address = this._map.get(serviceId);
        if(!address) {
            throw new Error(`Service '${serviceId}' not found.`);
        }
        return address;
    }

    /**
     * Возвращает адрес сервиса.
     * Если его нет - undefined.
     * @param serviceId 
     * @returns 
     */
    public getServiceHost(serviceId: string) : string | undefined {
        const address = this._map.get(serviceId);
        return address;
    }
}