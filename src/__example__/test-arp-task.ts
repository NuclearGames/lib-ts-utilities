import { IThreadTask } from "@nucleargames/lib-ts-multiprocess";
import { IThreadTaskContext, ThreadMessage } from "@nucleargames/lib-ts-multiprocess/lib/thread-system/thread-common";
import { ArpIntegrationClient } from "../arp-integration/arp-integration-client";
import { ArpTaskIntegrationArgs } from "../arp-integration/arp-integration-common";

export class TestArpTask implements IThreadTask {
    private _arpClient = new ArpIntegrationClient();

    async perform(context: IThreadTaskContext, args: any): Promise<void> {
        // Если аргументы таска включает не только аргументы ARP,
        // то доставать аргументы ARP из общего объекта args.
        // Можно выполнять параллельно с другой логикой.
        await this._arpClient.perform(new ArpTaskIntegrationArgs(context.sendMessage.bind(context), context.hasMessagePort.bind(context)), args);
        context.markFinished();
    }

    onMessage(message: ThreadMessage): void {
        this._arpClient.onMessage(message);
    }

}