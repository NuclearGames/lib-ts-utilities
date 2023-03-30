import { Server, ServerCredentials } from "@grpc/grpc-js";
import { GrpcHealthChecks, HealthResult } from "./grpc-health-checks/gprc-health-checks";

let someCheckResult = true;

enum HealthChecksIds {
    SomeCheck = 1,
    AnotherCheck = 2,
}

// Добавляем проверки.
GrpcHealthChecks.setHealthCheck(HealthChecksIds.SomeCheck, async () => someCheckResult);
GrpcHealthChecks.setHealthCheck(HealthChecksIds.AnotherCheck, async () => true, new Set(["tag1", "tag2"]));

// Добавляем сервисы.
GrpcHealthChecks.setServiceCheckFilter("testS", (r : HealthResult) => r.id == HealthChecksIds.SomeCheck);

const server = new Server();

// Регистрируем сервис.
GrpcHealthChecks.mapService(server);

server.bindAsync('0.0.0.0:4001', ServerCredentials.createInsecure(), () => {
    server.start();
    console.log('server is running on 0.0.0.0:4001');

    // Запускаем цикл проверок.
    GrpcHealthChecks.startLoop();
}); 


async function test() {
    await delay(10000);
    someCheckResult = false;
}

test();

async function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}