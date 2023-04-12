import { ThreadManager, ThreadMessage } from "@nucleargames/lib-ts-multiprocess";
import { ServiceStatusCollection } from "./service-status-collection";
import { ArpIntegration } from "./arp-integration";
import { ArpTaskIntegrationArgs } from "./arp-integration-common";

/**
 * Точка доступа к ARP, для всех процессов, на которых нет ARP клиента.
 */
export class ArpIntegrationHandler {
    private readonly _collection : ServiceStatusCollection;

    constructor() {
        // Создаем колекцию состояний сервисов.
        // Назначаем только те сервисы, которые интересны текущему процессу.
        const services = ArpIntegration.getOptions().threadRequiredServicesMap.get(ThreadManager.getThreadId())!;
        this._collection = new ServiceStatusCollection(services);
    }

    /** Возвращает коллекцию. Коллеция не меняется - можно кэшировать в других местах. */
    public get collection() : ServiceStatusCollection {
        return this._collection;
    }

    /** Инициализация коллекции. */
    public async initialize(args : ArpTaskIntegrationArgs) {
        // Отправляем сообщение потоку-держателю ArpClient-а, что надо отправить нам состояния сервисов.
        const options = ArpIntegration.getOptions();
        if(!args.hasMessagePort(options.arpClientThreadId)) {
            throw new Error(`No message port for ${options.arpClientThreadId}`);
        }
        args.sendMessage(options.arpClientThreadId, options.getCurrentStatusesMessageCode, null!);
    }

    /** Должно быть вызвано при получении сообщения. Обновляет значения в коллекции. */
    public onMessage(message: ThreadMessage): void {
        this._collection.tryUpdateFromMessage(message);
    }
}