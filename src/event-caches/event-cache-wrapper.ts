import { EventCache, EventCacheItem } from "./event-cache";

/**
 * Обертка для EventCache. Предоставляет функционал блокировки кэшей и отправки.
 */
export abstract class EventCacheWrapper {
    private readonly _cache = new EventCache();

    /**
     * Состояния блокировки кэшей сервисов.
     * Если значения по ключу сервиса нет - разблокировано.
     */
    private readonly _cacheLockedStatueMap = new Map<string, boolean>();

    /**
     * Словарь делегатов для каждого сервиса: разрешена ли отправка сообщения.
     * Если значения по ключу сервиса нет - отправка запрещена.
     */
    protected abstract get canSendMap(): Map<string, (key : number, item : any) => boolean>;

    /**
     * Обрабатывает сообщение.  
     * Если разрешена отправка - возвращает True.  
     * Если запрещена отправка - возвращает False и кладет в кэш. Если кэш заблокирован - сообщение теряется.
     * @param serviceId Идентификатор сервиса
     * @param key Идентификатор сообщения
     * @param item Объект сообщения
     * @returns 
     */
    public process(serviceId : string, key : number, item : any) : boolean {
        // Если отправка разрешена, возвращаем True и не добавляем в кэш.
        if(this.canSend(serviceId, key, item)) {
            return true;
        }

        // Если кэш не заблокирован, добавляем в кэш.
        if(!this.isCacheLocked(serviceId)) {
            this._cache.enqueue(serviceId, new EventCacheItem(key, item));
        }

        return false;
    }

    /**
     * Возвращает все сообщения из кэша.
     * @param serviceId Идентификатор сервиса
     * @returns 
     */
    public getCached(serviceId : string) : EventCacheItem[] {
        const items = []
        let item : EventCacheItem | undefined;
        do{
            let item = this._cache.dequeue(serviceId);
            if(item) {
                items.push(item);
            }
        }while(item);
        return items;
    }

    /** Блокирует кэш сервиса. */
    public lockCache(serviceId : string) {
        this._cacheLockedStatueMap.set(serviceId, true);
    }

    /** Разблокирует кэш сервиса. */
    public unlockCache(serviceId : string) {
        this._cacheLockedStatueMap.set(serviceId, false);
    }

    /** Проверяет может ли сообщение быть отправлено. */
    private canSend(serviceId : string, key : number, item : any) : boolean {
        let canSend = this.canSendMap.get(serviceId);
        if(!canSend) {
            return false;
        }
        return canSend(key, item);
    }

    /** Проверяет заблокирован ли кэш. */
    private isCacheLocked(serviceId : string) : boolean {
        let isLocked = this._cacheLockedStatueMap.get(serviceId);
        if(!isLocked) {
            return false;
        }
        return isLocked;
    }
}