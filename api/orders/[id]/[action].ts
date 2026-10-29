import type { IncomingMessage, ServerResponse } from 'node:http';
import handler from '../../[...path].ts';

export default function route(req: IncomingMessage, res: ServerResponse) {
  return handler(req, res);
}
