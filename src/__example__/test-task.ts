import { IThreadTask } from "@nucleargames/lib-ts-multiprocess";
import { IThreadTaskContext, ThreadMessage } from "@nucleargames/lib-ts-multiprocess/lib/thread-system/thread-common";
import { ServiceStatusCollection } from "../arp-integration/service-status-collection";

export class TestTask implements IThreadTask {
    private _serviceCollection = new ServiceStatusCollection();

    async perform(context: IThreadTaskContext, args: any): Promise<void> {
        this._serviceCollection.onStatusChanged.on(args => {
            console.log(`  [Test Process] Service status changed: ${args.serviceId} - ${args.status}`);
        });
    }

    onMessage(message: ThreadMessage): void {
        this._serviceCollection.tryUpdateFromMessage(message);
    }

}