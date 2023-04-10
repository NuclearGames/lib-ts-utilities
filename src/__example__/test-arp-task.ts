import { IThreadTask } from "@nucleargames/lib-ts-multiprocess";
import { IThreadTaskContext, ThreadMessage } from "@nucleargames/lib-ts-multiprocess/lib/thread-system/thread-common";
import { ArpIntegrationClient } from "../arp-integration/arp-integration-client";
import { ArpTaskIntegrationArgs } from "../arp-integration/arp-integration-common";

/**
 * Пример таска, который запускает клиент ARP.
 */
export class TestArpTask implements IThreadTask {
    // ARP клиент.
    private _arpClient = new ArpIntegrationClient();

    async perform(context: IThreadTaskContext, args: any): Promise<void> {
        // Подписка на изменение статуса сервисов.
        this._arpClient.collection.onStatusChanged.on(args => {
            console.log(`  [ARP Process] Service status changed: ${args.serviceId} - ${args.status}`);
        });

        // Если аргументы таска включает не только аргументы ARP,
        // то доставать аргументы ARP из общего объекта args.
        // Можно выполнять параллельно с другой логикой.
        // await будет крутится пока не кончится поток HealthStateSubscribe.
        await this._arpClient.perform(new ArpTaskIntegrationArgs(context.sendMessage.bind(context), context.hasMessagePort.bind(context)), args);
        
        // Помечаем таск завершенным.
        context.markFinished();
    }

    onMessage(message: ThreadMessage): void {
        // Нужно перекидывать сообщение в ARPClient.
        this._arpClient.onMessage(message);
    }

}