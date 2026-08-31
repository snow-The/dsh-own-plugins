import { Hono } from 'hono';
export declare const name = "skill-pack";
export declare const inject: string[];
export declare function apply(ctx: any): void;
export interface AppEnv {
    Bindings: {
        ctx: unknown;
    };
}
export declare function createHonoApp(_ctx: unknown): Hono<AppEnv>;
