import * as grpc from '@grpc/grpc-js';
import { Status } from '@grpc/grpc-js/build/src/constants';

import { HealthService, IHealthServer } from '../proto/health_grpc_pb';
import { HealthCheckRequest, HealthCheckResponse } from '../proto/health_pb';

/**
 * Grpc сервер для проверки состояния сервисов.
 * Сервер существует в единтсвенном экземпляре.
 * Все per-client состояния лежат внутри методов check/watch.
 */
export class GrpcHealthService {
	private readonly getServiceStatus : (service : string) => HealthCheckResponse.ServingStatus;

	constructor(getServiceStatus : (service : string) => HealthCheckResponse.ServingStatus) {
		this.getServiceStatus = getServiceStatus;
	}

	/**
	 * Регистрирует сервис в gRPC сервере.
	 * @param server 
	 */
	public map(server: grpc.Server): void {
		server.addService(HealthService, this.createServer());
	}

	/**
	 * Создает объект сервера, который содержит набор методов.
	 * @returns 
	 */
	private createServer(): IHealthServer {
		return {
			check: this.check.bind(this),
			watch: this.watch.bind(this)
		};
	}

	/**
	 * Отправляет ответ клиенту в поток.
	 * @param call 
	 * @param status 
	 * @param callback 
	 */
	private sendStatusResponse(
		call: grpc.ServerWritableStream<HealthCheckRequest, HealthCheckResponse>,
		status: HealthCheckResponse.ServingStatus,
		callback?: (error: Error | null | undefined) => void
	): void {
		// Send the status to the client
		const response = new HealthCheckResponse();
		response.setStatus(status);
		call.write(response, callback);
	}

	/**
	 * Создает объект ошибки NOT_FOUND.
	 * @returns 
	 */
	private createNotFoundError(): any {
		return {
			code: Status.NOT_FOUND,
			details: ""
		};
	}

	private check(
		call: grpc.ServerUnaryCall<HealthCheckRequest, HealthCheckResponse>,
		callback: grpc.sendUnaryData<HealthCheckResponse>
	): void {
		const service: string = call.request.getService();
		const response: HealthCheckResponse = new HealthCheckResponse();
		let status = this.getServiceStatus(service);
		if (status == HealthCheckResponse.ServingStatus.SERVICE_UNKNOWN) {
			// Этот метод предполагает возвращение ошибки, если сервис не найден.
			callback(this.createNotFoundError(), null);
			return;
		}
		response.setStatus(status);
		callback(null, response);
	}

	private watch(
		call: grpc.ServerWritableStream<HealthCheckRequest, HealthCheckResponse | Error>
	): void {
		const service: string = call.request.getService();

		const watchStatusMap = new Map<string, HealthCheckResponse.ServingStatus>();
		let watchError : Error | null = null;

		const iteration = () => {
			let status = this.getServiceStatus(service);
			let watchStatus = watchStatusMap.get(service);
	
			if (watchError != null) {
				// Terminate stream.
				clearInterval(interval);
				call.end(watchError);
			} else if (watchStatus !== status) {
				// Update the watch status.
				watchStatusMap.set(service, status);

				// Send the status to the client.
				this.sendStatusResponse(call, status, (error: Error | null | undefined) => {
					if (error) {
						// Terminate stream on next tick
						watchError = error;
					}
				});
			}
		};

		// Start loop and call first time immediately.
		const interval = setInterval(iteration, 1000);
		iteration();
	}
}