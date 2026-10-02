import { readApiBaseUrl } from "@/core/api/client/configuration";
import { createApiProxy } from "@/core/api/client/proxy";
import { createJsonLogger } from "@/core/observability";
import { parseCampusReturnTo } from "@/features/auth";

const handleApiRequest = createApiProxy({
  baseUrl: readApiBaseUrl,
  logger: createJsonLogger(),
  parseReturnTo: parseCampusReturnTo,
});

export {
  handleApiRequest as DELETE,
  handleApiRequest as GET,
  handleApiRequest as HEAD,
  handleApiRequest as OPTIONS,
  handleApiRequest as PATCH,
  handleApiRequest as POST,
  handleApiRequest as PUT,
};
