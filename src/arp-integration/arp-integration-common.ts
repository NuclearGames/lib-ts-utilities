import { ArpServiceStatus } from "@nucleargames/lib-warplane-mm-arp-proto";


export class ArpServiceStatusChangeArgs {
    constructor(
        public readonly serviceId: string,
        public readonly status: ArpServiceStatus) { }
}

export class ArpTaskIntegrationArgs {
    constructor(
        public readonly sendMessage : (threadId : number, messageCode : number, args : any) => void,
        public readonly hasMessagePort : (threadId : number) => boolean
    ) { }
}