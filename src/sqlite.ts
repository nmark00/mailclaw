import { existsSync } from 'node:fs';
import { DatabaseSync, StatementSync } from 'node:sqlite';

interface SQLiteOptions {
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
}

type SQLiteParam = string | number | bigint | null | Buffer;
type SQLiteRow = Record<string, unknown>;

function normalizeParams(params?: SQLiteParam[] | SQLiteParam): SQLiteParam[] {
    if (params === undefined) return [];
    return Array.isArray(params) ? params : [params];
}

// Mail's Envelope Index uses 64-bit integers (iCloud row IDs) that exceed JS safe range.
// Convert BigInt to number when in range, otherwise string.
function normalizeBigInts(row: SQLiteRow): SQLiteRow {
    const out: SQLiteRow = {};
    for (const [k, v] of Object.entries(row)) {
        if (typeof v === 'bigint') {
            out[k] = v >= BigInt(Number.MIN_SAFE_INTEGER) && v <= BigInt(Number.MAX_SAFE_INTEGER)
                ? Number(v)
                : v.toString();
        } else {
            out[k] = v;
        }
    }
    return out;
}

class SQLiteStatement {
    constructor(private readonly statement: StatementSync) {
        this.statement.setReadBigInts(true);
    }

    all(params?: SQLiteParam[] | SQLiteParam): SQLiteRow[] {
        return (this.statement.all(...normalizeParams(params)) as SQLiteRow[]).map(normalizeBigInts);
    }

    get(params?: SQLiteParam[] | SQLiteParam): SQLiteRow | undefined {
        const row = this.statement.get(...normalizeParams(params)) as SQLiteRow | undefined;
        return row ? normalizeBigInts(row) : undefined;
    }
}

export class SQLiteDatabase {
    private readonly database: DatabaseSync;

    constructor(filePath: string, options: SQLiteOptions = {}) {
        if (options.fileMustExist && !existsSync(filePath)) {
            throw new Error(`Database file does not exist: ${filePath}`);
        }

        this.database = new DatabaseSync(filePath, {
            readOnly: options.readonly ?? false
        });
        this.database.exec(`PRAGMA busy_timeout = ${options.timeout ?? 2000}`);
    }

    prepare(sql: string): SQLiteStatement {
        return new SQLiteStatement(this.database.prepare(sql));
    }

    close() {
        this.database.close();
    }
}
