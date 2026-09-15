export interface paths {
  "/v1": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["AppController_getHello"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/v1/health": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Health and performance check
     * @description Returns process status, uptime, memory, CPU and load averages.
     */
    get: operations["HealthController_check"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}
export type webhooks = Record<string, never>;
export interface components {
  schemas: {
    /**
     * @description Overall health state of the service.
     * @enum {string}
     */
    HealthStatus: "ok" | "degraded" | "unavailable";
    UptimeMetricsDto: {
      /**
       * @description Process uptime in seconds.
       * @example 86400.12
       */
      seconds: number;
    };
    MemoryMetricsDto: {
      /**
       * @description Total resident set size in bytes.
       * @example 123456789
       */
      rss: number;
      /**
       * @description Total size of the heap in bytes.
       * @example 98304000
       */
      heapTotal: number;
      /**
       * @description Heap actually used in bytes.
       * @example 61440000
       */
      heapUsed: number;
      /**
       * @description Memory used by C++ objects bound to JS in bytes.
       * @example 8912896
       */
      external: number;
    };
    CpuMetricsDto: {
      /**
       * @description Process CPU time in user mode (microseconds).
       * @example 823456
       */
      user: number;
      /**
       * @description Process CPU time in system mode (microseconds).
       * @example 123456
       */
      system: number;
      /**
       * @description Combined user+system CPU time (microseconds).
       * @example 946912
       */
      total: number;
    };
    LoadAverageDto: {
      /**
       * @description Load average over the last 1 minute.
       * @example 1.5
       */
      "1m": number;
      /**
       * @description Load average over the last 5 minutes.
       * @example 1.2
       */
      "5m": number;
      /**
       * @description Load average over the last 15 minutes.
       * @example 1.1
       */
      "15m": number;
    };
    HealthResponseDto: {
      /**
       * @description Overall health state of the service.
       * @example ok
       */
      status: components["schemas"]["HealthStatus"];
      /** @description Timestamp of the health check (ISO 8601). */
      timestamp: string;
      /** @description Process uptime. */
      uptime: components["schemas"]["UptimeMetricsDto"];
      /** @description Memory usage of the Node.js process. */
      memory: components["schemas"]["MemoryMetricsDto"];
      /** @description CPU time consumed by the Node.js process. */
      cpu: components["schemas"]["CpuMetricsDto"];
      /** @description System load average. */
      loadAverage: components["schemas"]["LoadAverageDto"];
    };
    /**
     * @description Machine-readable error code. Always one of the ExceptionCode enum.
     * @enum {string}
     */
    ExceptionCode:
      | "INVALID_ARGUMENT"
      | "UNAUTHORIZED"
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "CONFLICT"
      | "SPACE_AT_CAPACITY"
      | "RATE_LIMITED"
      | "INTERNAL_ERROR";
    ApiErrorBodyDto: {
      /**
       * @description Machine-readable error code. Always one of the ExceptionCode enum.
       * @example NOT_FOUND
       */
      code: components["schemas"]["ExceptionCode"];
      /**
       * @description Human-readable description of the error.
       * @example Resource not found
       */
      message: string;
      /** @description Optional structured context about the error (e.g. offending field). */
      details?: {
        [key: string]: unknown;
      };
    };
    ApiErrorResponseDto: {
      /** @description The error envelope. */
      error: components["schemas"]["ApiErrorBodyDto"];
    };
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
  AppController_getHello: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  HealthController_check: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description The service is healthy. */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["HealthResponseDto"];
        };
      };
      /** @description The service failed to produce a health check. */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiErrorResponseDto"];
        };
      };
    };
  };
}
