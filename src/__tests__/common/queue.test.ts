import {  Queue } from "../../common/queue";

test('Queue', () => {
    const queue = new Queue<number>();
    queue.enqueue(1);
    queue.enqueue(2);

    expect(queue.dequeue()).toBe(1);
    expect(queue.dequeue()).toBe(2);
    expect(queue.dequeue()).toBe(undefined);

    queue.enqueue(3);
    expect(queue.length).toBe(1);
    queue.clear();
    expect(queue.length).toBe(0);

    queue.enqueue(4);
    queue.enqueue(5);
    const arr = queue.getItems();
    expect(arr[0]).toBe(4);
    expect(arr[1]).toBe(5);
});