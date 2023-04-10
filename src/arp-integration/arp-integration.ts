export class ArpOptions {
    constructor(
        /** Id процесса, на котором будет запущен ARP Client. */
        public readonly arpClientThreadId : number,

        /** Код сообщения о изменении статуса сервиса. */
        public readonly serviceStatusChangeMessageCode: number,

        /** Код сообщения о запросе актуальных состояний сервисов процессом. */
        public readonly getCurrentStatusesMessageCode : number,

        /** Словарь Id процесса - набор сервисов, которые ему интересны. */
        public readonly threadRequiredServicesMap : Map<number, Set<string>>) { }
}

/**
 * Интеграция ARP клиента.
 * 
 * Пример использования:
 * ```
 * // Устанавливаем настройки.
 * // Это должно выполняться для всех процессов (т.е. до ThreadManager.runApp).
 * ArpIntegration.useOptions(new ArpOptions(
 *   ThreadIds.ArpClient,
 *   MessageCodes.ArpServiceStatusChange, 
 *   MessageCodes.GetCurrentStatuses,
 *   new Map<number, Set<string>>([
 *       [ThreadIds.Test, new Set<string>(["Core", "IncomeDbGateway"])]
 *   ])));
 * 
 * // Запустить ArpIntegrationClient внутри таска одного из процессов.
 * // Запустить ArpIntegrationHandler на всех процессах, где нет ArpIntegrationClient.
 * ```
 */
export abstract class ArpIntegration {
    /** Объект настроек. */
    private static options: ArpOptions;

    /**
     * Возвращает объект настроек.
     * @returns 
     */
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
        if(this.options) {
            throw new Error("ARP Options already set.");
        }
        this.options = options;
    }
}