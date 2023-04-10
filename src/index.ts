//export * from "./grpc-health-checks/gprc-health-checks"

import { Server, ServerCredentials } from "@grpc/grpc-js";
import { GrpcHealthChecks, HealthResult } from "./grpc-health-checks/gprc-health-checks";
import { ThreadManager } from "@nucleargames/lib-ts-multiprocess";
import { ArpIntegrationClient, ArpIntegrationClientArgs } from "./arp-integration/arp-integration-client";
import { ArpIntegration, ArpOptions } from "./arp-integration/arp-integration";
import { LockBoxConfigurator, LockBoxConfiguratorOptions, LockBoxConfiguratorUtilities } from "@nucleargames/yandex-cloud-lockbox-lib";
import { TestTask } from "./__example__/test-task"
import { ArpServiceMapSettings } from "./arp-integration/arp-service-host-map";

// Название этого сервиса.
const SERVICE_ID = "IncomeDbGateway";
const CORE_SERVICE_ID = "Core";

export enum ThreadIds {
    ArpClient = 1,
    Test = 2
}

export enum TaskIds {
    ArpClient = 1,
    Test = 2
}

export enum MessageCodes {
    ArpServiceStatusChange = 0,
    GetCurrentStatuses = 1
}

enum HealthChecksIds {
    SomeCheck = 1,
    AnotherCheck = 2,
}

// Инициализация процессов.
ThreadManager.setIndexFile("./lib/index.js");
ThreadManager.registerTask(TaskIds.ArpClient, ArpIntegrationClient);
ThreadManager.registerTask(TaskIds.Test, TestTask);

// Инициализация ARP.
ArpIntegration.useOptions(new ArpOptions(
    ThreadIds.ArpClient,
    MessageCodes.ArpServiceStatusChange, 
    MessageCodes.GetCurrentStatuses,
    new Map<number, Set<string>>([
        [ThreadIds.Test, new Set<string>(["Core", "IncomeDbGateway"])]
    ])));

// Запускаем логику главного потока (здесь вилка на главный процесс и подпроцессы).
ThreadManager.runApp(async () => {
    // Создаем потоки.
    const threadMap = new Map((await Promise.all([
        ThreadManager.createThread(),
        ThreadManager.createThread()
    ])).map(x => [x.threadId, x]));

    // Создаем каналы связи между потоками.
    await Promise.all([
        ThreadManager.createMessageChannel(threadMap.get(ThreadIds.ArpClient)!, threadMap.get(ThreadIds.Test)!)
    ]);
   
    // Качаем лутбокс.
    LockBoxConfigurator.useOptions(new LockBoxConfiguratorOptions("WarplaneMM", "-"));
    await LockBoxConfiguratorUtilities.configureYandexCloudSecretsDefault("./.secrets/example.appsettings.json");
    const serviceAddressMap = new ArpServiceMapSettings(LockBoxConfigurator.getSectionEntriesMap("ServiceMap"));
    const serverAddress = serviceAddressMap.getRequiredServiceHost(SERVICE_ID)!;
    const coreAddress = serviceAddressMap.getRequiredServiceHost(CORE_SERVICE_ID)!;

    // Добавляем проверки.
    GrpcHealthChecks.setHealthCheck(HealthChecksIds.SomeCheck, async () => someCheckResult);
    GrpcHealthChecks.setHealthCheck(HealthChecksIds.AnotherCheck, async () => true, new Set(["tag1", "tag2"]));
    
    // Добавляем сервисы (опционально; сервис по умолчанию итак использует все проверки).
    GrpcHealthChecks.setServiceCheckFilter("testS", (r : HealthResult) => true);
    
    const server = new Server();
    
    // Регистрируем сервис проверок здоровья.
    GrpcHealthChecks.mapService(server);
    
    server.bindAsync(serverAddress, ServerCredentials.createInsecure(), () => {
        server.start();
        console.log(`server is running on ${serverAddress}`);
    
        // Запускаем цикл проверок.
        GrpcHealthChecks.startLoop();

        // Запускаем ARP клиент.
        threadMap.get(ThreadIds.ArpClient)!.runTask(TaskIds.ArpClient, new ArpIntegrationClientArgs(coreAddress, CORE_SERVICE_ID));

        // Запускаем тестовую задачу на процессе.
        threadMap.get(ThreadIds.Test)!.runTask(TaskIds.Test, null!);

        // Для теста хелс чеков.
        test();
    }); 
});



// Для теста хелс чеков.

let someCheckResult = true;

async function test() {
    await delay(10000);
    someCheckResult = false;
}

async function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}