import { campusBrowserApi } from "./browser";
import type { CampusApi, components } from "./index";

interface SystemHealth {
  status: components["schemas"]["HealthStatus"];
}

interface SystemGateway {
  getHealth(): Promise<SystemHealth>;
}

function createSystemGateway(api: CampusApi): SystemGateway {
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

const systemGateway = createSystemGateway(campusBrowserApi);

void systemGateway.getHealth;

// @ts-expect-error Unpublished paths cannot be called through the typed client.
void campusBrowserApi.GET("/v1/not-published");
