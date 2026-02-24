import { Elysia, t } from "elysia";
import { data } from "../data";

const app = new Elysia({ prefix: "/api" }).use(data);

export const GET = app.fetch;
export const POST = app.fetch;
