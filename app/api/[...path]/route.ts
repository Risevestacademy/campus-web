import { readApiBaseUrl } from "@/core/api/client/configuration";
import { createApiProxy } from "@/core/api/client/proxy";
import { createJsonLogger } from "@/core/observability";
import { parseReturnTo } from "@/features/auth";
import { INVITE_TOKEN_COOKIE_SCOPE } from "@/features/invitation";

const handleApiRequest = createApiProxy({
  baseUrl: readApiBaseUrl,
  cookiesSpentBySignIn: [INVITE_TOKEN_COOKIE_SCOPE],
  logger: createJsonLogger(),
  parseReturnTo: parseReturnTo,
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
