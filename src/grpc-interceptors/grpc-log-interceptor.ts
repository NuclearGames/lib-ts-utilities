import { InterceptingCall, Interceptor, InterceptorProvider, ListenerBuilder, RequesterBuilder } from "@grpc/grpc-js";
import { ClientMethodDefinition } from "@grpc/grpc-js/build/src/make-client";

const logInterceptorRequester : Interceptor = function(options, nextCall) : InterceptingCall {
    const requester = new RequesterBuilder()
        .withStart(function(metadata, listener, next) {
            const interceptedListener = new ListenerBuilder()
                .withOnReceiveMessage((message, next) => {
                    const date = (new Date()).toUTCString();
                    const dataJson = JSON.stringify(message.array);
                    console.log(`RECV ${date} ${options.method_definition.path} - ${dataJson}`);
                    next(message);
                })
                .build();
            next(metadata, interceptedListener);
        })
        .withSendMessage((message, next) => {
            const date = (new Date()).toUTCString();
            const dataJson = JSON.stringify(message.array);
            console.log(`SEND ${date} ${options.method_definition.path} - ${dataJson}`);
            next(message);
        })
        .build();

    return new InterceptingCall(nextCall(options), requester);
};

const logInterceptorProvider : InterceptorProvider = (methodDescriptor : ClientMethodDefinition<any, any>) : Interceptor => {
        return logInterceptorRequester;
};

export function getGrpcLogInterceptorProviders() : InterceptorProvider[] {
    return [logInterceptorProvider];
}