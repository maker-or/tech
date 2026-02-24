import { Elysia } from "elysia";

export const data = new Elysia({ prefix: "/data" }).post(
  "/v1",
  ({ body }) => {
    console.log(body);
    return body;
  },
);
