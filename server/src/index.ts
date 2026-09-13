import { createApp } from "./app.js";
import { env } from "./utils/env.js";

const app = createApp();

app.listen(env.port, () => {
  console.log(`GATEFLOW API listening on http://localhost:${env.port}`);
});
