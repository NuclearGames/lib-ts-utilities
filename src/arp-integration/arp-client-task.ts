import { credentials } from "@grpc/grpc-js";
import { IThreadTask, IThreadTaskContext, ThreadMessage } from "@nucleargames/lib-ts-multiprocess";
import { ArpClient, ArpHealthStateSubscribeRequest, ArpHealthStateSubscribeResponse, ArpServiceCollection, ArpServiceStatus, ArpWakeUpNotifyRequest } from "@nucleargames/lib-warplane-mm-arp-proto";
import { ArpIntegration } from "./arp-client";


export class ArpClientTaskArgs {
    constructor(
        public readonly coreAddress: string,
        public readonly serviceId : string
    ){}
}

export class ArpServiceStatusChangeArgs {
    constructor(
        readonly serviceId : string,
        readonly status : ArpServiceStatus) { }
}

// ToDo: сделать класс-коллекцию состояний сервисов.
// Этот класс будет у каждого потока.
// Должен быть метод, принимающий класс сообщения ThreadMessage и пытающийся меняющий состояние.
// (Вызываться будет из onMessage процессов)
// Также должно быть событие.

/**
 * ARP клиент.
 * Отправляет WakeUpNotify.
 * Подписывается на HealthStateSubscribe, 
 * передает полученные данные другим процессам согласно таблице из настроек.
 * Не отправляет начальные состояния - только изменения, пришедшие по сети.
 */
export class ArpClientTask implements IThreadTask {
    private _context : IThreadTaskContext;
    private _args : ArpClientTaskArgs;
    private _client : ArpClient;
    
    async perform(context: IThreadTaskContext, args: any): Promise<void> {
        this._context = context;
        this._args = args as ArpClientTaskArgs;

        // Проверяем наличие каналов связи по мапе.
        for(const [threadId, services] of ArpIntegration.getOptions().threadRequiredServicesMap) {
            if(!this._context.hasMessagePort(threadId)) {
                throw new Error(`Not message port for '${threadId}', which declared at arguments thread service map.`);
            }
        }

        // Создаем клиента и выполняем запросы.
        this._client = new ArpClient(this._args.coreAddress, credentials.createInsecure());
        await this.wakeUpNotify();
        await this.healthStateSubscribe();
        this._context.markFinished();
    }

    /** Отправляет запрос WakeUpNotify. */
    private wakeUpNotify(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = new ArpWakeUpNotifyRequest();
            request.setId(this._args.serviceId);
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
    private async healthStateSubscribe() : Promise<void> {
        const request = new ArpHealthStateSubscribeRequest();
        const serviceCollection = new ArpServiceCollection();
        serviceCollection.setListList(this.getAllRequiredServicesArray());
        request.setServiceid(this._args.serviceId);
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
    private getAllRequiredServicesArray() : string[] {
        const array : string[] = [];
        for(const [threadId, services] of ArpIntegration.getOptions().threadRequiredServicesMap) {
            for(const service of services) {
                if(!array.includes(service)) {
                    array.push(service);
                }
            }
        }
        return array;
    }

    private onHealthStateSubscribeReceive(response : ArpHealthStateSubscribeResponse): void {
        console.log(` HealthStateSubscribe: ${response.getId()} - ${response.getStatus()}`);

        const messageArgs = new ArpServiceStatusChangeArgs(
            response.getId(), 
            response.getStatus());

        for(const [threadId, services] of ArpIntegration.getOptions().threadRequiredServicesMap) {
            if(services.has(messageArgs.serviceId)){
                this._context.sendMessage(
                    threadId, 
                    ArpIntegration.getOptions().serviceStatusChangeMessageCode, 
                    messageArgs);
            }
        }
    }

    onMessage(message: ThreadMessage): void {
        console.log(`    [${this._context.threadId}] Got message from ${message.senderThreadId}. Code: ${message.code}; Args: ${message.args}`);
    }
}