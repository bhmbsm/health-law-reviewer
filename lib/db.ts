import {env} from 'cloudflare:workers';
export function database(){return (env as unknown as {DB:D1Database}).DB;}
