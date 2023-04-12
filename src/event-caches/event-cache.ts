import { Queue } from "../common/queue";

export class EventCacheItem {
    constructor(
        public readonly key: number,
        public readonly value: any
    ) { }
}

export class EventCache {
    private readonly _map = new Map<string, Queue<any>>();

    public enqueue(serviceId : string, item: EventCacheItem) {
        let queue = this._map.get(serviceId);
        if(!queue) {
            queue = new Queue<EventCacheItem>();
            this._map.set(serviceId, queue);
        }
        queue.enqueue(item);
    }

    public dequeue(serviceId : string) : EventCacheItem | undefined {
        let queue = this._map.get(serviceId);
        if(!queue) {
            return undefined;
        }
        return queue.dequeue();
    }
}