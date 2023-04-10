import { IThreadTask } from "@nucleargames/lib-ts-multiprocess";
import { IThreadTaskContext, ThreadMessage } from "@nucleargames/lib-ts-multiprocess/lib/thread-system/thread-common";
import { ArpIntegrationHandler } from "../arp-integration/arp-integration-handler";
import { ArpTaskIntegrationArgs } from "../arp-integration/arp-integration-common";

export class TestTask implements IThreadTask {
    private _arpHandler = new ArpIntegrationHandler();

    async perform(context: IThreadTaskContext, args: any): Promise<void> {
        this._arpHandler.initialize(new ArpTaskIntegrationArgs(context.sendMessage, context.hasMessagePort));

        this._arpHandler.collection.onStatusChanged.on(args => {
            console.log(`  [Test Process] Service status changed: ${args.serviceId} - ${args.status}`);
        });
    }

    onMessage(message: ThreadMessage): void {
        this._arpHandler.onMessage(message);
    }

}