import * as grpc from "@grpc/grpc-js";
import { HealthCheckResponse } from '../proto/health_pb';
import { GrpcHealthService } from "./grpc-health-service";

/** Проверка здоровья и ее данные. */
class HealthCheck {
    constructor(
        public readonly check: () => Promise<boolean>,
        public readonly tags: ReadonlySet<string>
    ) { }
}

/** Результат проверки здоровья. */
export class HealthResult {
    constructor(
        public readonly id: number,
        public readonly status: boolean,
        public readonly tags: ReadonlySet<string>
    ) { }
}

/**
 * Проверка здоровья.
 * 
 * Пример использования:
 * ```
 *  // Идентификаторы проверок. 
 *  enum HealthChecksIds {
 *      SomeCheck = 1,
 *      AnotherCheck = 2,
 *  }
 *
 *  // Добавляем проверки.
 *  GrpcHealthChecks.setHealthCheck(HealthChecksIds.SomeCheck, async () => true);
 *  GrpcHealthChecks.setHealthCheck(HealthChecksIds.AnotherCheck, async () => true, new Set(["tag1", "tag2"]));
 *
 *  // Добавляем сервисы.
 *  GrpcHealthChecks.setServiceCheck("serviceA", (r : HealthResult) => r.id == HealthChecksIds.SomeCheck);
 *  GrpcHealthChecks.setServiceCheck("serviceB", (r : HealthResult) => r.tags.has("tag2"));
 *
 *  const server = new Server();
 *
 *  // Регистрируем сервис.
 *  GrpcHealthChecks.mapService(server);
 *
 *  // Запускаем сервер.
 *  server.bindAsync('0.0.0.0:4001', ServerCredentials.createInsecure(), () => {
 *      server.start();
 *      console.log('server is running on 0.0.0.0:4001');
 *  }); 
 * ```
 */
export abstract class GrpcHealthChecks {
    /** Проверки здоровья. */
    private static healthChecks: Map<number, HealthCheck> = new Map();

    /** Набор сервисов и их фильров. */
    private static serviceCheckFilterMap: Map<string, (r: HealthResult) => boolean> = new Map();

    /** Результаты проверок. */
    private static checkResultsMap: Map<number, HealthResult> = new Map();

    /** Состояния сервисов. */
    private static serviceStatusMap: Map<string, HealthCheckResponse.ServingStatus> = new Map();

    /** Сервис. */
    private static serivce: GrpcHealthService;

    /** Пустой набор тегов. */
    private static emptyTagSet = new Set<string>();

    /**
     * Устанавливает проверку под указанным идентификатором.
     * @param id идентификатор проверки.
     * @param check проверка.
     * @param tags теги (опционально).
     */
    public static setHealthCheck(id: number, check: () => Promise<boolean>, tags: ReadonlySet<string> | null = null) {
        this.healthChecks.set(id, new HealthCheck(check, tags ?? this.emptyTagSet));
    }

    /**
     * Устанавилвает сервис с указанным именем и фильтром проверок.
     * @param service имя сервиса.
     * @param filter фильтр: принимает результат проверки и возвращает true, если нужно использовать эту проверку.
     */
    public static setServiceCheckFilter(service: string, filter: (r: HealthResult) => boolean) {
        this.serviceCheckFilterMap.set(service, filter);
    }

    /** Добавляет сервис к серверу. */
    public static mapService(server: grpc.Server) {
        if (this.serivce != undefined) {
            throw new Error("GrpcHealthChecks already mapped to server.");
        }

        this.serivce = new GrpcHealthService(this.getServiceStatus.bind(this));
        this.serivce.map(server);
    }

    /** Возвращает статус сервиса. */
    public static getServiceStatus(service: string): HealthCheckResponse.ServingStatus {
        return this.serviceStatusMap.get(service) ?? HealthCheckResponse.ServingStatus.SERVICE_UNKNOWN;
    }

    private static setServiceStatus(service: string, status: HealthCheckResponse.ServingStatus) {
        this.serviceStatusMap.set(service, status);
    }

    private static async runChecks() {
        // Прогоняем все проверки.
        for (const [id, check] of this.healthChecks) {
            const status = await check.check();
            this.checkResultsMap.set(id, new HealthResult(id, status, check.tags));
        }

        // Обновляем статусы сервисов.
        for (const [service, filter] of this.serviceCheckFilterMap) {
            let status = HealthCheckResponse.ServingStatus.SERVING;

            for (const [id, result] of this.checkResultsMap) {
                if(!filter(result)) {
                    continue;
                }

                if (!result.status) {
                    status = HealthCheckResponse.ServingStatus.NOT_SERVING;
                    break;
                }
            }

            this.setServiceStatus(service, status);
        }
    }
}