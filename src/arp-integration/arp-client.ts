export class ArpOptions {
    constructor(
        readonly serviceStatusChangeMessageCode: number,
        public readonly threadRequiredServicesMap : Map<number, Set<string>>) { }
}

export abstract class ArpIntegration {
    /** Объект настроек. */
    private static options: ArpOptions;

    public static getOptions() {
        if(!this.options) {
            throw new Error("Options not set.");
        }
        return this.options;
    }

    /**
     * Устанавливает настройки.
     * Должно выполняться всеми процессами.
     * @param options 
     */
    public static useOptions(options: ArpOptions) {
        this.options = options;
    }


    public static addTask() {

    }
}