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

/** Настройки. */
export class HealthChecksOptions {
    constructor(
        /** Время до первой проверки. Миллисекунды. */
        public readonly delay : number,

        /** Время между проверками. Миллисекунды. */
        public readonly period : number,
    ){}
}

/**
 * Проверки здоровья.  
 * 
 * Должны быть добавлены проверки и сервисы.  
 * Каждый сервис имеет фильтр, который указывает результаты каких проверок использовать.  
 * Сервис по умолчанию (с путым именем) использует все проверки. Может быть переопределен:  
 * ``` GrpcHealthChecks.setServiceCheck("", (r : HealthResult) => true); ```
 * 
 * Первая проверка осуществляется сразу при запуске цикла проверок.  
 * Следующая проверка осуществялется с задержкой (по умолчанию 5 секунд).  
 * Последующие проверки осуществляются с заданным периодом (по умолчанию 30 секунд).  
 * Время проверок задается в настройках.  
 * 
 * Пример использования:
 * ```
 *  // Идентификаторы проверок. 
 *  enum HealthChecksIds {
 *      SomeCheck = 1,
 *      AnotherCheck = 2,
 *  }
 *
 *  // Перезаписываем настройки (опционально).
 *  GrpcHealthChecks.useOptions(new HealthChecksOptions(5000, 30000));
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
 * 
 *      // Запускаем цикл проверок.
 *      GrpcHealthChecks.startChecks();
 *  }); 
 * ```
 */
export abstract class GrpcHealthChecks {  
    /** Пустой набор тегов. */
    private static emptyTagSet = new Set<string>();

    /** Проверки здоровья. */
    private static healthChecks: Map<number, HealthCheck> = new Map();

    /** Набор сервисов и их фильров. */
    private static serviceCheckFilterMap: Map<string, (r: HealthResult) => boolean> = new Map([
        ["", () => true]
    ]);

    /** Результаты проверок. */
    private static checkResultsMap: Map<number, HealthResult> = new Map();

    /** Состояния сервисов. */
    private static serviceStatusMap: Map<string, HealthCheckResponse.ServingStatus> = new Map();

    /** Сервис. */
    private static serivce: GrpcHealthService;

    /** Объект настроек. */
    private static options : HealthChecksOptions = new HealthChecksOptions(5000, 30000);

    /** Запущен ли цикл проверок. */
    private static loopStarted = false;

    /** Выполняются ли в данный момент проверки. */
    private static checksPerforming = false;

    /**
     * Устанавливает настройки.
     * @param options 
     */
    public static useOptions(options : HealthChecksOptions) {
        this.options = options;
    }

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

    /** Запускает проверки. */
    public static startLoop() {
        if(this.loopStarted){
            throw new Error("GrpcHealthChecks loop already started.");
        }
        this.loopStarted = true;
        this.runLoop();
    }

    /**
     * Возвращает статус сервиса.
     * Если сервис не зарегистрирован, то возвращается SERVICE_UNKNOWN.  
     * Если сервис зарегистрирован, но не было ни одной проверки, то возвращается UNKNOWN.  
     * Иначе - состояние сервиса.
     * @param service 
     * @returns 
     */
    public static getServiceStatus(service: string): HealthCheckResponse.ServingStatus {
        const status = this.serviceStatusMap.get(service);
        if (status == undefined) {
            return this.serviceCheckFilterMap.has(service) 
                ? HealthCheckResponse.ServingStatus.UNKNOWN 
                : HealthCheckResponse.ServingStatus.SERVICE_UNKNOWN;
        }
        return status;
    }

    private static setServiceStatus(service: string, status: HealthCheckResponse.ServingStatus) {
        this.serviceStatusMap.set(service, status);
    }

    private static async runLoop() {
        // Начальная проверка.
        this.tryPerformChecks();

        // Начальная задержка.
        await new Promise(resolve => setTimeout(resolve, this.options.delay));

        // Запускаем цикл проверок. Первая проверка выполняется сразу.
        const interval = setInterval(this.tryPerformChecks.bind(this), this.options.period);
        this.tryPerformChecks();
    }

    private static async tryPerformChecks() {
        // Если проверки уже выполняются, то пропускаем.
        if (this.checksPerforming) {
            return;
        }
        this.checksPerforming = true;

        // Прогоняем все проверки.
        // Последовательно, потому что лучше долго, чем сильно грузить систему.
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

        this.checksPerforming = false;
    }
}