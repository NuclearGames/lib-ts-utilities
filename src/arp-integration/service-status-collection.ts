import { ArpServiceStatus } from "@nucleargames/lib-warplane-mm-arp-proto"
import { EventSrc, IEvent, ThreadManager, ThreadMessage } from "@nucleargames/lib-ts-multiprocess";
import { ArpIntegration } from "./arp-integration";
import { ArpServiceStatusChangeArgs } from "./arp-integration-common";

export class ServiceStatusChangeEvent {
    constructor(
        public readonly serviceId: string,
        public readonly status: ArpServiceStatus
    ) { }
}

export class ServiceStatusCollection {
    private readonly _onStatusChanged = new EventSrc<ServiceStatusChangeEvent>;
    private readonly _statusMap = new Map<string, ArpServiceStatus>;

    constructor() {
        // Ставим требуемым сервисам значение по умолчанию.
        const services = ArpIntegration.getOptions().threadRequiredServicesMap.get(ThreadManager.getThreadId());
        if(services) {  
            for (const service of services) {
                this._statusMap.set(service, ArpServiceStatus.NOTSERVING);
            }
        }
    }

    /** Событие: при изменении статуса сервиса. */
    public get onStatusChanged(): IEvent<ServiceStatusChangeEvent> {
        return this._onStatusChanged.expose();
    }

    /**
     * Возвращает статус сервиса.
     * Если сервиса нет в списке - возвращает ServiceUnknown.
     * @param serviceId 
     * @returns 
     */
    public getStatus(serviceId : string) {
        let status = this._statusMap.get(serviceId);
        if(!status) {
            status = ArpServiceStatus.SERVICEUNKNOWN;
        }
        return status;
    }

    /**
     * Устанавливает состояние.
     * Если сервис не указан в таблице для текущего процесса, кидает ошибку.
     * @param serviceId 
     * @param status 
     */
    public setStatus(serviceId: string, status: ArpServiceStatus) {
        const oldStatus = this._statusMap.get(serviceId);
        if(!oldStatus) {
            throw new Error(`Service ${serviceId} not found.`);
        }
        if (oldStatus != status) {
            this._statusMap.set(serviceId, status);
            this._onStatusChanged.invoke(new ServiceStatusChangeEvent(serviceId, status));
        }
    }

    /**
     * Обновляет состояние из аргументов сообщения.
     * @param message 
     */
    public updateFromMessage(message: ArpServiceStatusChangeArgs): void {
        this._statusMap.set(message.serviceId, message.status);
    }

    /**
     * Обновляет значение из сообщения, если оно соответсвует нужному коду.
     * @param message 
     * @returns True - если передано сообщение с состоянием сервиса. False - иначе.
     */
    public tryUpdateFromMessage(message: ThreadMessage): boolean {
        if (message.code == ArpIntegration.getOptions().serviceStatusChangeMessageCode) {
            this.updateFromMessage(message.args);
            return true;
        }
        return false;
    }
}