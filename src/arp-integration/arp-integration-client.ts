import { credentials } from "@grpc/grpc-js";
import { ThreadManager, ThreadMessage } from "@nucleargames/lib-ts-multiprocess";
import { ArpClient, ArpHealthStateSubscribeRequest, ArpHealthStateSubscribeResponse, ArpServiceCollection, ArpServiceStatus, ArpWakeUpNotifyRequest } from "@nucleargames/lib-warplane-mm-arp-proto";
import { ArpIntegration } from "./arp-integration";
import { ServiceStatusCollection } from "./service-status-collection";
import { ArpServiceStatusChangeArgs, ArpTaskIntegrationArgs } from "./arp-integration-common";

export class ArpIntegrationClientArgs {
    constructor(
        public readonly coreAddress: string,
        public readonly serviceId: string
    ) { }
}

/**
 * ARP клиент.
 * Отправляет WakeUpNotify.
 * Подписывается на HealthStateSubscribe, 
 * передает полученные данные другим процессам согласно таблице из настроек.
 * Не отправляет начальные состояния - только изменения, пришедшие по сети.
 */
export class ArpIntegrationClient {
    private _args: ArpTaskIntegrationArgs;
    private _clientArgs: ArpIntegrationClientArgs;
    private _client: ArpClient;
    private readonly _collection : ServiceStatusCollection;

    constructor() {
        const services = this.getAllRequiredServicesArray();
        this._collection = new ServiceStatusCollection(new Set<string>(services));
    }

    public get collection() : ServiceStatusCollection {
        return this._collection;
    }

    public async perform(args: ArpTaskIntegrationArgs, clientArgs: ArpIntegrationClientArgs): Promise<void> {
        this._args = args;
        this._clientArgs = clientArgs;

        // Проверяем наличие каналов связи по мапе.
        for (const [threadId, services] of ArpIntegration.getOptions().threadRequiredServicesMap) {
            if (!this._args.hasMessagePort(threadId)) {
                throw new Error(`No message port for '${threadId}', which declared at arguments thread service map.`);
            }
        }

        // Создаем клиента и выполняем запросы.
        this._client = new ArpClient(this._clientArgs.coreAddress, credentials.createInsecure());
        await this.wakeUpNotify();
        await this.healthStateSubscribe();
    }

    /** Отправляет запрос WakeUpNotify. */
    private wakeUpNotify(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = new ArpWakeUpNotifyRequest();
            request.setId(this._clientArgs.serviceId);
            this._client.wakeUpNotify(request, (err, response) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /** Выполняет подписку HealthStateSubscribe. */
    private async healthStateSubscribe(): Promise<void> {
        const request = new ArpHealthStateSubscribeRequest();
        const serviceCollection = new ArpServiceCollection();
        serviceCollection.setListList(this.getAllRequiredServicesArray());
        request.setServiceid(this._clientArgs.serviceId);
        request.setServices(serviceCollection);

        await new Promise<void>((resolve, reject) => {
            const responseStream = this._client.healthStateSubscribe(request);

            responseStream.on("data", this.onHealthStateSubscribeReceive.bind(this));
            responseStream.on("end", resolve);
            responseStream.on("error", reject);
        });

        console.info(` HealthStateSubscribe stream closed.`);
    }

    /** Возвращать массив всех необходимых сервисов без повторений. */
    private getAllRequiredServicesArray(): string[] {
        const array: string[] = [];
        for (const [threadId, services] of ArpIntegration.getOptions().threadRequiredServicesMap) {
            for (const service of services) {
                if (!array.includes(service)) {
                    array.push(service);
                }
            }
        }
        return array;
    }

    private onHealthStateSubscribeReceive(response: ArpHealthStateSubscribeResponse): void {
        console.log(` HealthStateSubscribe: ${response.getId()} - ${response.getStatus()}`);

        // Устанавилваем значение в коллекцию.
        if(this.collection.contains(response.getId())) {
            this._collection.setStatus(response.getId(), response.getStatus());
        }

        // Формируем сообщение для рассылки.
        const messageArgs = new ArpServiceStatusChangeArgs(
            response.getId(),
            response.getStatus());

        // Рассылаем всем заинтересованным потокам.
        for (const [threadId, services] of ArpIntegration.getOptions().threadRequiredServicesMap) {
            if (services.has(messageArgs.serviceId)) {
                this._args.sendMessage(
                    threadId,
                    ArpIntegration.getOptions().serviceStatusChangeMessageCode,
                    messageArgs);
            }
        }
    }

    private sendStatuses(threadId: number) {
        // Себе не отправляем.
        if(ThreadManager.getThreadId() == threadId) {
            return;
        }

        // Отправляем процессу состояних сервисов, которые ему интересны.
        const services = ArpIntegration.getOptions().threadRequiredServicesMap.get(threadId);
        if (services) {
            for (const serviceId of services) {
                const messageArgs = new ArpServiceStatusChangeArgs(
                    serviceId,
                    this._collection.getStatus(serviceId));

                this._args.sendMessage(
                    threadId,
                    ArpIntegration.getOptions().serviceStatusChangeMessageCode,
                    messageArgs);
            }
        }
    }

    public onMessage(message: ThreadMessage): void {
        if (message.code == ArpIntegration.getOptions().getCurrentStatusesMessageCode) {
            this.sendStatuses(message.senderThreadId);
        }
    }
}