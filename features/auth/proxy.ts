// Entry point for the root proxy.ts. Unlike index.ts it pulls in no React,
// client components, or server-only modules, so it bundles into Next's proxy
// layer.
export { guardCampusRequest } from "./services/campus-proxy.service";
