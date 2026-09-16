import { browserApi } from "./browser";
import type { ApiClient, components } from "./index";

interface SystemHealth {
  status: components["schemas"]["HealthStatus"];
}

interface SystemGateway {
  getHealth(): Promise<SystemHealth>;
}

function createSystemGateway(api: ApiClient): SystemGateway {
  return {
    async getHealth() {
      const result = await api.GET("/v1/health");

      if (result.error) {
        throw new Error("The Campus system health request failed.", {
          cause: result.error.error.code,
        });
      }

      return {
        status: result.data.status,
      };
    },
  };
}

const systemGateway = createSystemGateway(browserApi);

void systemGateway.getHealth;

// @ts-expect-error Unpublished paths cannot be called through the typed client.
void browserApi.GET("/v1/not-published");
