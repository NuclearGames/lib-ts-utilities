import { EventCache, EventCacheItem } from "../../event-caches/event-cache";

class TestMessageA {
    constructor(public Value: number) { }
}

class TestMessageB {
    constructor(public Value: number) { }
}

test("EventCache", () => {
    const cache = new EventCache();
    const item1 = new EventCacheItem(1, new TestMessageA(2));
    const item2 = new EventCacheItem(2, new TestMessageB(2));

    cache.enqueue("service1", item1);
    cache.enqueue("service1", item2);
    cache.enqueue("service2", item2);

    expect(cache.dequeue("service1")).toEqual(item1);
    expect(cache.dequeue("service2")).toEqual(item2);
    expect(cache.dequeue("service1")).toEqual(item2);
    expect(cache.dequeue("service1")).toBeUndefined();
});