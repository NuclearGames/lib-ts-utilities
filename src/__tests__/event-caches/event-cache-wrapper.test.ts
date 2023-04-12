import { EventCacheWrapper } from "../../event-caches/event-cache-wrapper";

class Wrapper extends EventCacheWrapper {
    protected get canSendMap(): Map<string, (key: number, item: any) => boolean> {
       return this.map;
    }
    constructor(private readonly map: Map<string, (key: number, item: any) => boolean>) {
        super();
    }
}

class TestMessage {
    constructor(public Value: number) { }
}

test("EventCacheWrapper-CanSendTest", () => {
    const canSendMap = new Map<string, (key: number, item: any) => boolean>([
        ["service1", (key, item) => true],
        ["service2", (key, item) => false],
        ["service3", (key, item) => true],
        ["service4", (key, item) => false],
        ["service5", (key, item) => false],
    ]);

    const wrapper = new Wrapper(canSendMap);
    const message = new TestMessage(1);

    // Проверяем Process.
    for (const [key, value] of canSendMap) {
        expect(wrapper.process(key, 1, message)).toBe(value(message.Value, message));
    }

    // Меняем провальные делегаты на успешные и проверяем, что GetCached возвращает сообщение.
    for (const [key, value] of canSendMap) {
        const mustHaveCached = !value(message.Value, message);
        const messages = wrapper.getCached(key);
        expect(messages.length).toBe(mustHaveCached ? 1 : 0);
    }
});

test("EventCacheWrapper-CacheLockTest", () => {
    const canSendMap = new Map<string, (key: number, item: any) => boolean>([
        ["service1", (key, item) => true],
        ["service2", (key, item) => false]
    ]);

    const wrapper = new Wrapper(canSendMap);
    const message = new TestMessage(1);

    const test = (lockCache: boolean) => {
        if (lockCache) {
            wrapper.lockCache("service1");
            wrapper.lockCache("service2");
        } else {
            wrapper.unlockCache("service1");
            wrapper.unlockCache("service2");
        }

        expect(wrapper.process("service1", 1, message)).toBe(true);
        expect(wrapper.process("service2", 1, message)).toBe(false);

        expect(wrapper.getCached("service1").length).toBe(0);
        expect(wrapper.getCached("service2").length).toBe(lockCache ? 0 : 1);
    };

    test(false);
    test(true);
    test(false);
    test(true);
    test(true);
    test(false);
});