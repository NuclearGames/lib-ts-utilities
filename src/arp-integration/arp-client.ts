import { credentials } from "@grpc/grpc-js";
import { IThreadTask, IThreadTaskContext, ThreadMessage } from "@nucleargames/lib-ts-multiprocess";
import { ArpClient, ArpHealthStateSubscribeRequest, ArpHealthStateSubscribeResponse, ArpServiceCollection, ArpWakeUpNotifyRequest } from "@nucleargames/lib-warplane-mm-arp-proto";

export class ArpClientTaskArgs {
    constructor(
        public readonly coreAddress: string,
        public readonly serviceId : string,
        public readonly requiredServices : string[] // ToDo: поменять на мапу <Номер процесса; Набор сервисов>.
    ){}
}

// ToDo: сделать класс-коллекцию состояний сервисов.
// Этот класс будет у каждого потока.
// Должен быть метод, принимающий класс сообщения ThreadMessage и пытающийся меняющий состояние.
// (Вызываться будет из onMessage процессов)
// Также должно быть событие.

export class ArpClientTask implements IThreadTask {
    private _context : IThreadTaskContext;
    private _args : ArpClientTaskArgs;
    private _client : ArpClient;
    
    async perform(context: IThreadTaskContext, args: any): Promise<void> {
        this._context = context;
        this._args = args as ArpClientTaskArgs;

        // ToDo: проверить наличие каналов связи по мапе.
        // ToDo: отправить всем процессам дефолтные состояния сервисов.

        this._client = new ArpClient(this._args.coreAddress, credentials.createInsecure());

        await this.wakeUpNotify();
    }

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

    private async healthStateSubscribe() : Promise<void> {
        const request = new ArpHealthStateSubscribeRequest();
        const serviceCollection = new ArpServiceCollection();
        serviceCollection.setListList(this._args.requiredServices);
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

    private onHealthStateSubscribeReceive(response : ArpHealthStateSubscribeResponse): void {
        console.log(` HealthStateSubscribe: ${response.getId()} - ${response.getStatus()}`);

        // ToDo: Отправлять сообщение тем потокам, которые заинтересованы этим сервисом.
    }

    onMessage(message: ThreadMessage): void {
        console.log(`    [${this._context.threadId}] Got message from ${message.senderThreadId}. Code: ${message.code}; Args: ${message.args}`);
    }
}