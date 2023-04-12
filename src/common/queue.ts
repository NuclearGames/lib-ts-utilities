export class Queue<T> {
    private _items : T[];

    constructor(...values: T[]) {
        this._items = [...values];
    }

    public get length(): number {
        return this._items.length;
    }

    public getItems() : T[] {
        return this._items;
    }

    public enqueue(item: T) {
        this._items.push(item);
    }

    public dequeue(): T | undefined {
        return this._items.shift();
    }

    public clear() {
        this._items.length = 0;
    }
}