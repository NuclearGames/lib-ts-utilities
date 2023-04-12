import { ArpServiceStatus } from "@nucleargames/lib-warplane-mm-arp-proto";


/** Аргументы сообщения о изменении статуса сервиса. */
export class ArpServiceStatusChangeArgs {
    constructor(
        public readonly serviceId: string,
        public readonly status: ArpServiceStatus) { }
}

/** Агрументы для создания ArpClient или ArpHandler. */
export class ArpTaskIntegrationArgs {
    constructor(
        public readonly sendMessage : (threadId : number, messageCode : number, args : any) => void,
        public readonly hasMessagePort : (threadId : number) => boolean
    ) { }
}