//export * from "./grpc-health-checks/gprc-health-checks"

import { Server, ServerCredentials } from "@grpc/grpc-js";
import { GrpcHealthChecks, HealthResult } from "./grpc-health-checks/gprc-health-checks";
import { ThreadManager } from "@nucleargames/lib-ts-multiprocess";
import { ArpClientTask, ArpClientTaskArgs } from "./arp-integration/arp-client-task";
import { ArpIntegration, ArpOptions } from "./arp-integration/arp-client";
import { LockBoxConfigurator, LockBoxConfiguratorOptions, LockBoxConfiguratorUtilities } from "@nucleargames/yandex-cloud-lockbox-lib";

// Название этого сервиса.
const SERVICE_ID = "IncomeDbGateway";

export enum ThreadIds {
    ArpClient = 0,
    Test = 1,
}

export enum TaskIds {
    ArpClient = 1,
    Test
}

export enum MessageCodes {
    ArpServiceStatusChange = 0
}

enum HealthChecksIds {
    SomeCheck = 1,
    AnotherCheck = 2,
}

// Инициализация процессов.
ThreadManager.setIndexFile("./lib/index.js");
ThreadManager.registerTask(TaskIds.ArpClient, ArpClientTask);

// Инициализация ARP.
ArpIntegration.useOptions(new ArpOptions(
    MessageCodes.ArpServiceStatusChange, 
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
    // ToDo: вытянуть мапу сервисов.

    // Добавляем проверки.
    GrpcHealthChecks.setHealthCheck(HealthChecksIds.SomeCheck, async () => someCheckResult);
    GrpcHealthChecks.setHealthCheck(HealthChecksIds.AnotherCheck, async () => true, new Set(["tag1", "tag2"]));
    
    // Добавляем сервисы (опционально; сервис по умолчанию итак использует все проверки).
    GrpcHealthChecks.setServiceCheckFilter("testS", (r : HealthResult) => true);
    
    const server = new Server();
    
    // Регистрируем сервис проверок здоровья.
    GrpcHealthChecks.mapService(server);
    
    server.bindAsync('0.0.0.0:4001', ServerCredentials.createInsecure(), () => {
        server.start();
        console.log('server is running on 0.0.0.0:4001');
    
        // Запускаем цикл проверок.
        GrpcHealthChecks.startLoop();

        // Запускаем ARP клиент.
        threadMap.get(ThreadIds.ArpClient)!.runTask(TaskIds.ArpClient, new ArpClientTaskArgs("127.0.0.1:3000", "Core"));

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