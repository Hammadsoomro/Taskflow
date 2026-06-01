import serverless from "serverless-http";
import { createServer } from "../../server/index";

// ✅ Create Express app from server/index.ts
const app = await createServer();

// ✅ Export Netlify handler
export const handler = serverless(app);
