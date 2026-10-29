import type { IncomingMessage, ServerResponse } from 'node:http';
import handler from '../api/[...path].ts';

function invoke(method: string, url: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = { method, url } as IncomingMessage;
    const mock: {
      statusCode: number;
      headers: Record<string, string>;
      setHeader(name: string, value: string): void;
      end(payload?: string): void;
    } = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) {
        mock.headers[name] = value;
      },
      end(payload) {
        try {
          resolve({
            status: mock.statusCode,
            body: payload ? JSON.parse(payload) : null,
          });
        } catch (error) {
          reject(error);
        }
      },
    };

    try {
      handler(req, mock as unknown as ServerResponse);
    } catch (error) {
      reject(error);
    }
  });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const health = await invoke('GET', '/api/health');
assert(health.status === 200, 'health should return 200');
assert(health.body.mode === 'READ_ONLY_SNAPSHOT', 'health should clearly indicate snapshot mode');
assert(health.body.totalBranches === 35, 'health should report 35 listed branches');

const branchResponse = await invoke('GET', '/api/branches');
assert(branchResponse.status === 200, 'branches should return 200');
assert(branchResponse.body.totalCount === 35, 'should contain 35 source rows');
const branches = branchResponse.body.branches;
const sums = branches.reduce(
  (sum: { male: number; female: number; kids: number; total: number }, branch: any) => ({
    male: sum.male + branch.inventory.male.onHand,
    female: sum.female + branch.inventory.female.onHand,
    kids: sum.kids + branch.inventory.kids.onHand,
    total: sum.total + branch.inventory.totalOnHand,
  }),
  { male: 0, female: 0, kids: 0, total: 0 },
);
assert(sums.male === 1500, 'Male total should reconcile to 1,500');
assert(sums.female === 1830, 'Female total should reconcile to 1,830');
assert(sums.kids === 410, 'Kids total should reconcile to 410');
assert(sums.total === 3740, 'Grand total should reconcile to 3,740');

const githurai = await invoke('GET', '/api/branches/br-008');
assert(githurai.status === 200, 'Githurai branch details should be found');
assert(githurai.body.branch.inventory.totalOnHand === 100, 'Githurai baseline should be 100 frames');
const iten = await invoke('GET', '/api/branches/br-010');
assert(iten.status === 200, 'Iten branch details should be found');
assert(iten.body.branch.inventory.totalOnHand === 0, 'Iten baseline should be zero');

const orders = await invoke('GET', '/api/orders');
assert(orders.status === 200 && orders.body.orders.length === 0, 'demo orders must not be served');
const activity = await invoke('GET', '/api/activity-log');
assert(activity.status === 200 && activity.body.movements.length === 0, 'unverified transaction history must not be served');
const warehouse = await invoke('GET', '/api/warehouse');
assert(warehouse.status === 200 && warehouse.body.warehouse === null, 'unknown warehouse stock must remain unknown');

const validation = await invoke('GET', '/api/validation');
assert(validation.status === 200, 'validation should return 200');
assert(validation.body.reconciliation.isReconciled === true, 'source sheet baseline should reconcile');
assert(validation.body.reconciliation.discrepancy === 0, 'baseline discrepancy should be zero');

const write = await invoke('POST', '/api/orders');
assert(write.status === 503, 'writes must be blocked until auth and durable storage exist');
assert(write.body.code === 'READ_ONLY_SNAPSHOT', 'write failure should explain snapshot-only mode');

const options = await invoke('OPTIONS', '/api/orders');
assert(options.status === 204, 'preflight should return 204');

console.log('PASS: Vercel snapshot API checks (source totals, corrected discrepant branches, demo exclusion, unverified warehouse, read-only writes).');
