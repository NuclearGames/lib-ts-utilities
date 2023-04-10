import { IThreadTask } from "@nucleargames/lib-ts-multiprocess";
import { IThreadTaskContext, ThreadMessage } from "@nucleargames/lib-ts-multiprocess/lib/thread-system/thread-common";
import { ArpIntegrationHandler } from "../arp-integration/arp-integration-handler";
import { ArpTaskIntegrationArgs } from "../arp-integration/arp-integration-common";

/**
 * Пример таска, который не запускает клиента ARP, но использует его данные.
 */
export class TestTask implements IThreadTask {
    // Представительство ARP на потоках, где нет ARP клиента.
    private _arpHandler = new ArpIntegrationHandler();

    async perform(context: IThreadTaskContext, args: any): Promise<void> {
        // Инициализация обработчика.
        // Будут запрошены актуальные состояния сервисов.
        this._arpHandler.initialize(new ArpTaskIntegrationArgs(context.sendMessage.bind(context), context.hasMessagePort.bind(context)));

        // Подписка на изменение статуса сервисов.
        this._arpHandler.collection.onStatusChanged.on(args => {
            console.log(`  [Test Process] Service status changed: ${args.serviceId} - ${args.status}`);
        });
    }

    onMessage(message: ThreadMessage): void {
        // Нужно перекидывать сообщение в ARPHandler.
        this._arpHandler.onMessage(message);
    }

}